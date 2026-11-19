// cd_edit in JavaScript: the same text as cd_edit.py byte for byte (tests/cd-compare.js), so the editor
// works on a CellDesigner map with no Python; the master for the viewer's own build and the editor. cd_edit.py beside it is its
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
  var PROC = 10.0, GATE_R = 6.0;
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
  // the place of a modifier's end round the glyph, as cdrender's target() takes it: targetLineIndex's second number, 3
  // when it names none of the six (SQUARE)
  function spotOf(m) { var k = I((get(m, 'targetLineIndex') || '-1,2').split(',')[1]); return has(SQUARE, k) ? k : 3; }
  function isGate(el) { return (get(el, 'type') || '').indexOf('BOOLEAN_LOGIC_GATE') === 0; }
  // logic gates (the CellDesigner editor): a gate is a node of the editor's GraphML, '<reaction>|g<n>' for the
  // gate modification n of a reaction, '<reaction>|g' for a gate between entities (a BOOLEAN_LOGIC_GATE reaction), at
  // the last point of its editPoints (absolute); the points before it bend its line to the target, in the frame from the
  // gate to the target; each input's line is its own entry (a reaction's modification of the gate's modificationType on
  // that alias, as cdrender finds it; a GateMember between entities), its bends in the frame from the input to the gate.
  // A dragged gate is written back as that last point; its bends follow what the editor shows
  function gateLines(d, rx, x, bp) {
    var gm = findall(x, 'cd:listOfGateMember/cd:GateMember'), top = gm.filter(isGate);
    if (bp.length !== 1 || !top.length || !d.alias.has(get(bp[0], 'alias'))) return null;
    var gp = editPoints(get(top[0], 'editPoints'));
    if (!gp.length) return null;
    var rid = get(rx, 'id'), G = gp[gp.length - 1], pa = get(bp[0], 'alias'), EB = d.end(bp[0], pa), B = EB[0];
    var r = { id: rid, x: x, gate: true, el: top[0], top: gm.indexOf(top[0]), pa: pa, B: B, ancB: EB[1], G: G, bends: gp.slice(0, -1).map(function (p) { return fromFrame(G, B, p); }), ins: [], mods: [], links: [], gates: [], glyph: false };
    gm.forEach(function (g, j) {
      var a = get(g, 'aliases');
      if (top.indexOf(g) >= 0 || !d.alias.has(a)) return;
      var Mm = d.end(find(g, 'cd:linkTarget'), a);
      r.ins.push({ n: j, el: g, alias: a, M: Mm[0], anc: Mm[1], bends: editPoints(get(g, 'editPoints')).map(function (p) { return fromFrame(Mm[0], G, p); }) });
    });
    r.ra = r.ins.length ? r.ins[0].alias : pa;   // where the gate sits in the GraphML's nesting
    return r;
  }
  function lines(d, rx) {
    var x = find(rx, 's:annotation/cd:extension');
    var rt = find(x, 'cd:reactionType'), typ = rt ? (text(rt) || '') : null;
    var br = findall(x, 'cd:baseReactants/cd:baseReactant'), bp = findall(x, 'cd:baseProducts/cd:baseProduct');
    var mods = findall(x, 'cd:listOfModification/cd:modification');
    if (typ === 'BOOLEAN_LOGIC_GATE') return gateLines(d, rx, x, bp);
    if (br.length !== 1 || bp.length !== 1) return null;
    var ra = get(br[0], 'alias'), pa = get(bp[0], 'alias');
    if (!d.alias.has(ra) || !d.alias.has(pa)) return null;
    var EA = d.end(br[0], ra), EB = d.end(bp[0], pa), A = EA[0], B = EB[0];
    var ep = find(x, 'cd:editPoints');
    var bends = editPoints(ep ? text(ep) : '').map(function (p) { return fromFrame(A, B, p); });
    var r = { id: get(rx, 'id'), x: x, ra: ra, pa: pa, A: A, B: B, ancA: EA[1], ancB: EB[1], bends: bends, glyph: FULL.indexOf(typ) >= 0, mods: [], links: [], gates: [] };
    if (!r.glyph) return mods.some(isGate) ? null : r;
    var line = cut(d, r, bends), cs = find(x, 'cd:connectScheme');
    var k = Math.min(cs ? I(get(cs, 'rectangleIndex', 0)) : 0, line.length - 2), P = line[k], Q = line[k + 1];
    var sq = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2], fl = unit(Q[0] - P[0], Q[1] - P[1]);
    r.k = k; r.sq = sq; r.fl = fl; r.P = P; r.Q = Q;
    var own = {}, ins = new Set(), shared = false;   // a gate's input: its own entry, the first of its alias and the gate's modificationType (cdrender's); others of the pair not drawn
    mods.forEach(function (m, n) {
      if (!isGate(m)) return;
      get(m, 'aliases').split(',').forEach(function (a) { ins.add(a + '\u0001' + get(m, 'modificationType')); });
      var gp = editPoints(get(m, 'editPoints'));
      if (!gp.length) return;
      var G = gp[gp.length - 1], T = target(m, sq, fl), gi = r.gates.length;
      r.gates.push({ n: n, el: m, G: G, T: T, spot: spotOf(m), bends: gp.slice(0, -1).map(function (p) { return fromFrame(G, T, p); }) });
      get(m, 'aliases').split(',').forEach(function (a) {
        var k2 = mods.findIndex(function (o) { return get(o, 'aliases') === a && get(o, 'type') === get(m, 'modificationType'); });
        if (k2 >= 0 && has(own, k2) && own[k2] !== gi) shared = true;
        else if (k2 >= 0) own[k2] = gi;
      });
    });
    if (shared) return null;   // an input's line shared by two gates (its bends in two frames): left as it is
    mods.forEach(function (m, n) {
      var a = get(m, 'aliases');
      if (isGate(m) || !d.alias.has(a) || (!has(own, n) && ins.has(a + '\u0001' + get(m, 'type')))) return;
      var g = has(own, n) ? r.gates[own[n]] : null, Mm = d.end(find(m, 'cd:linkTarget'), a), M = Mm[0], T = g ? g.G : target(m, sq, fl);
      r.mods.push({ n: n, el: m, alias: a, M: M, anc: Mm[1], T: T, spot: spotOf(m), gate: g ? own[n] : null, bends: editPoints(get(m, 'editPoints')).map(function (p) { return fromFrame(M, T, p); }) });
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
    line[0] = d.clip(r.ra, r.A, r.ancA, line[1], true);   // the shape alone, as cdrender places the square
    line[L - 1] = d.clip(r.pa, r.B, r.ancB, line[L - 2], true);
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
    var procs = {}, gnodes = {};   // the process glyphs, the gates: id -> [reaction, the gate's centre]
    rxs.forEach(function (r) {
      if (!r.glyph && !r.gate) return;
      var a = chain(r.ra), b = new Set(chain(r.pa)), p = null;
      for (var j = 1; j < a.length; j++) if (b.has(a[j])) { p = a[j]; break; }
      if (!ks.has(p)) ks.set(p, []);
      if (r.glyph) { ks.get(p).push(r.id + '|proc'); procs[r.id + '|proc'] = r; }
      if (r.gate) { ks.get(p).push(r.id + '|g'); gnodes[r.id + '|g'] = r.G; }
      r.gates.forEach(function (g) { ks.get(p).push(r.id + '|g' + g.n); gnodes[r.id + '|g' + g.n] = g.G; });
    });
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
      if (has(gnodes, i)) {   // a gate: cdrender's circle of radius 6
        var G = gnodes[i];
        out.push(s + '<node id="' + escape(i) + '"><data key="d6"><y:ShapeNode>' + geo([G[0] - GATE_R, G[1] - GATE_R, 2 * GATE_R, 2 * GATE_R]) + '<y:Shape type="ellipse"/></y:ShapeNode></data></node>');
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
        // a phenotype's points indented half its height, as cdrender's hexagon (the editor's outline reads indent)
        var props = k === 'Macromolecule' ? '<y:StyleProperties><y:Property name="com.yworks.sbgn.style.radius" value="5"/></y:StyleProperties>'
          : k === 'Phenotype' ? '<y:StyleProperties><y:Property name="com.yworks.sbgn.style.indent" value="0.5"/></y:StyleProperties>' : '';
        // a degraded species' circle inset an eighth of its box on each side, as cdrender draws it (the editor's outline reads inset)
        var ins = d.alias.get(i)[0] === 'DEGRADED' ? '<y:StyleProperties><y:Property name="com.yworks.sbgn.style.inset" value="0.125"/></y:StyleProperties>' : '';
        if (k === 'ellipse' || k === 'rectangle') out.push(s + '<node id="' + escape(i) + '"><data key="d6"><y:ShapeNode>' + geo(b) + labels(d, i, b) + '<y:Shape type="' + k + '"/>' + ins + '</y:ShapeNode></data></node>');
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
    var edge = function (eid, s, t2, sp, tp, ps, at) {
      var q = ps.map(function (p) { return '<y:Point x="' + repr(p[0] - off[0]) + '" y="' + repr(p[1] - off[1]) + '"/>'; }).join('');
      out.push('    <edge id="' + escape(eid) + '" source="' + escape(s) + '" target="' + escape(t2) + '"><data key="d10"><y:PolyLineEdge><y:Path sx="' + repr(sp[0]) + '" sy="' + repr(sp[1]) + '" tx="' + repr(tp[0]) + '" ty="' + repr(tp[1]) + '"' + (at || '') + '>' + q + '</y:Path><y:BendStyle smoothed="false"/></y:PolyLineEdge></data></edge>');
    };
    rxs.forEach(function (r) {
      var rid = r.id, A = r.A, B = r.B, pb = r.ancB ? port(B, r.pa) : [0.0, 0.0], O = [0.0, 0.0];
      if (r.gate) {
        r.ins.forEach(function (q) { edge(rid + '|i' + q.n, q.alias, rid + '|g', q.anc ? port(q.M, q.alias) : O, O, q.bends); });
        edge(rid + '|a', rid + '|g', r.pa, O, pb, r.bends);
        return;
      }
      var pa = r.ancA ? port(A, r.ra) : O;
      if (!r.glyph) { edge(rid + '|a', r.ra, r.pa, pa, pb, r.bends); return; }
      var g = rid + '|proc', k = r.k, sq = r.sq;
      edge(rid + '|a', r.ra, g, pa, O, r.bends.slice(0, k));
      edge(rid + '|b', g, r.pa, O, pb, r.bends.slice(k));
      r.gates.forEach(function (q) { edge(rid + '|m' + q.n, rid + '|g' + q.n, g, O, [q.T[0] - sq[0], q.T[1] - sq[1]], q.bends, ' spot="' + q.spot + '"'); });
      r.mods.forEach(function (m) {
        var mp = m.anc ? port(m.M, m.alias) : O;
        if (m.gate !== null) edge(rid + '|m' + m.n, m.alias, rid + '|g' + r.gates[m.gate].n, mp, O, m.bends);
        else edge(rid + '|m' + m.n, m.alias, g, mp, [m.T[0] - sq[0], m.T[1] - sq[1]], m.bends, ' spot="' + m.spot + '"');
      });
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
    var r = new (DP(opt))().parseFromString(gtext, 'application/xml').documentElement, boxes = new Map(), ups = new Map(), bends = new Map(), paths = new Map(), ends = new Map();
    iter(r, GNS, 'node').forEach(function (n) {
      var g = descendant(n, YNS, 'Geometry'), p = n.parentNode;
      boxes.set(get(n, 'id'), ['x', 'y', 'width', 'height'].map(function (k) { return F(get(g, k)); }));
      while (p && p.nodeType === 1 && !(p.namespaceURI === GNS && p.localName === 'node')) p = p.parentNode;
      ups.set(get(n, 'id'), p && p.nodeType === 1 ? get(p, 'id') : null);   // the node that holds it
    });
    iter(r, GNS, 'edge').forEach(function (e) {
      bends.set(get(e, 'id'), iter(e, YNS, 'Point').map(function (p) { return [F(get(p, 'x')), F(get(p, 'y'))]; }));
      ends.set(get(e, 'id'), [get(e, 'source'), get(e, 'target')]);
      var pa = descendant(e, YNS, 'Path');
      if (pa) { var q = ['sx', 'sy', 'tx', 'ty'].map(function (k) { return F(get(pa, k, 0)); }), sp = get(pa, 'spot'); if (sp) q.push(I(sp)); paths.set(get(e, 'id'), q); }
    });
    return [boxes, ups, bends, paths, ends];
  }
  var ANCHORS = ['N', 'S', 'W', 'E', 'NE', 'NW', 'SE', 'SW', 'NNE', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW', 'NNW'];
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
      // the same connection point on the node's new box (Snap or Pack resized it, and the GraphML was made again from the
      // file): not a move, so a point between the five (ENE) is kept, not taken to the nearest side
      var ob = old.get(alias), nb = nw.get(alias);
      if (anc && nb && ob[2] && ob[3]) {
        var now = [(P[0] - ob[0]) / ob[2] * nb[2] - nb[2] / 2, (P[1] - ob[1]) / ob[3] * nb[3] - nb[3] / 2];
        if (py.hypot(port[0] - now[0], port[1] - now[1]) < 0.5) return null;
      }
      // one of CellDesigner's 16 anchors on the node (Make main trades two lines' ports, ENE included): kept as that anchor
      var c2 = cen(nw.get(alias)), hit = null;
      ANCHORS.some(function (k) { var A = d.at(alias, k); if (py.hypot(port[0] - (A[0] - c2[0]), port[1] - (A[1] - c2[1])) < 0.5) { hit = k; return true; } return false; });
      return hit !== null ? hit : side(port, nw.get(alias));
    };
    var x = o.x;
    (o.gate ? [] : [['baseReactant', rid + '|a', 's', o.ra, o.A, o.ancA]]).concat([['baseProduct', rid + (o.glyph ? '|b' : '|a'), 't', o.pa, o.B, o.ancB]]).forEach(function (q) {
      var pos = moved(q[1], q[2], q[3], q[4], q[5], o.old);
      if (pos !== null) {
        var el = find(x, 'cd:' + q[0] + 's/cd:' + q[0]);
        anchor(T, el, T.span('<celldesigner:' + q[0] + ' [^>]*alias="' + reEscape(q[3]) + '"', s[0], s[1]), pos, q[0]);
      }
    });
    var lists = {};
    [['listOfModification', 'modification'], ['listOfReactantLinks', 'reactantLink'], ['listOfProductLinks', 'productLink'], ['listOfGateMember', 'GateMember']].forEach(function (q) {
      var ls = T.span('<celldesigner:' + q[0] + '>', s[0], s[1]), found = [], i0 = ls ? ls[0] : null;
      while (ls) { var m = T.span('<celldesigner:' + q[1] + ' ', i0, ls[1]); if (!m) break; found.push(m); i0 = m[1]; }
      lists[q[1]] = found;
    });
    var at = function (list, n) { if (n >= list.length) throw new Error('IndexError: list index out of range'); return list[n]; };
    o.mods.forEach(function (m) {
      var pos = moved(rid + '|m' + m.n, 's', m.alias, m.M, m.anc, o.old);
      if (pos !== null) anchor(T, m.el, at(lists.modification, m.n), pos, 'modification', [get(m.el, 'modifiers'), m.alias]);
    });
    if (o.gate) o.ins.forEach(function (q) {
      var pos = moved(rid + '|i' + q.n, 's', q.alias, q.M, q.anc, o.old);
      if (pos !== null) anchor(T, q.el, at(lists.GateMember, q.n), pos, 'GateMember', [get(d.alias.get(q.alias)[2], 'species'), q.alias]);
    });
    // a modifier's end the editor set round the process glyph: the place it chose (spot, one of CellDesigner's six: the
    // corners and the middles of the two sides off the main line), by its number, so the frame it was drawn in does not
    // matter
    if (o.glyph) o.mods.filter(function (m) { return m.gate === null; }).concat(o.gates).forEach(function (m) {   // a gate's line ends round the glyph too
      var q = paths.get(rid + '|m' + m.n);
      if (q && q.length > 4 && q[4] !== m.spot) m.el.setAttribute('targetLineIndex', (get(m.el, 'targetLineIndex') || '-1,2').split(',')[0] + ',' + q[4]);   // written with the edit points (reaction())
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
  // a line's end moved to another node in the editor: the
  // reaction's participant at that end rewritten in every place CellDesigner keeps it, the rest byte for byte: the base
  // reactant or product (species, alias), an added reactant's or product's link (reactant or product, alias), a modifier
  // (modifiers, aliases, its linkTarget's species and alias), SBML's speciesReference or modifierSpeciesReference
  // (species, its celldesigner:alias), and for a catalysis the species' listOfCatalyzedReactions where the file keeps
  // it; the old port taken off with it (ports() then writes the one the editor chose). Only an end at a species moves,
  // never the process glyph's end of a line, and never onto an alias the reaction already has (the editor refuses it).
  // A kineticLaw is left as it is (none on the demo maps). ends: edge id -> [source, target] in the GraphML; olds:
  // lines() of each reaction; the text as it was when no end moved
  var ROLE = { baseReactant: ['species', 'alias', 'listOfReactants', 'speciesReference'], baseProduct: ['species', 'alias', 'listOfProducts', 'speciesReference'],
    reactantLink: ['reactant', 'alias', 'listOfReactants', 'speciesReference'], productLink: ['product', 'alias', 'listOfProducts', 'speciesReference'],
    modification: ['modifiers', 'aliases', 'listOfModifiers', 'modifierSpeciesReference'] };
  var CAT = /^(UNKNOWN_)?CATALYSIS$/;
  function nth(T, open, s, n) { var i0 = s[0], q = null; for (var c = 0; c <= n; c++) { q = T.span(open, i0, s[1]); if (!q) return null; i0 = q[1]; } return q; }
  function rewire(d, t, ends, olds) {
    var T = new Text(t), done = new Set(), cats = [], sp = function (a) { return get(d.alias.get(a)[2], 'species'); };
    Object.keys(olds).forEach(function (rid) {
      var r = olds[rid];
      if (!r || r.gate) return;   // a gate's ends are not moved to other nodes (its inputs listed in several places)
      // the reaction's ends: [edge, end, alias in the file, kind, n, el]; an end may move onto an alias none of the
      // reaction's other ends of its kind has as the GraphML now stands (one freed by an earlier move is free)
      var all = [[rid + '|a', 0, r.ra, 'baseReactant', 0, null], [rid + (r.glyph ? '|b' : '|a'), 1, r.pa, 'baseProduct', 0, null]]
        .concat(r.mods.filter(function (m) { return m.gate === null; }).map(function (m) { return [rid + '|m' + m.n, 0, m.alias, 'modification', m.n, m.el]; }))
        .concat(r.links.map(function (l) { return [rid + '|' + (l.into ? 'r' : 'p') + l.n, l.into ? 0 : 1, l.alias, l.into ? 'reactantLink' : 'productLink', l.n, null]; }));
      var now = all.map(function (q) { var g = ends.get(q[0]), a = g ? g[q[1]] : null; return a && a !== q[2] && d.alias.has(a) ? a : q[2]; });
      var todo = [];
      // a modifier and a reactant or product may share a species alias (as files have it, and Make main swaps into); two
      // reactants or products may not (a line of length 0)
      var mod = function (q) { return q[3] === 'modification'; };
      // all or nothing: one end refused leaves the reaction as it was (a swap half done would change the network)
      var free = function (i) { return !now.some(function (b, k) { return k !== i && b === now[i] && mod(all[k]) === mod(all[i]); }); };
      if (all.some(function (q, i) { return now[i] !== q[2] && !free(i); })) return;
      all.forEach(function (q, i) { if (now[i] !== q[2]) todo.push([q[3], q[2], now[i], q[4], q[5]]); });
      if (!todo.length) return;
      var s = T.span('<reaction [^>]*\\bid="' + reEscape(rid) + '"'), gone = new Set();
      todo.forEach(function (q) {
        var R = ROLE[q[0]], old = q[1], a = q[2], so = sp(old), sn = sp(a);
        var el = nth(T, '<celldesigner:' + q[0] + ' ', s, q[3]);
        if (!el) return;
        T.attrs(el[0], [[R[0], sn], [R[1], a]]);
        var lt = q[0] === 'modification' ? T.span('<celldesigner:linkTarget[\\s>/]', el[0], el[1]) : null, w = lt || el;
        if (lt) T.attrs(lt[0], [['species', sn], ['alias', a]]);
        var la = T.span('<celldesigner:linkAnchor ', w[0], w[1]);
        if (la) T.put(la[0], la[1] + (T.t.slice(la[1], la[1] + 1) === '\n' ? 1 : 0), '');
        if (q[4] && CAT.test(get(q[4], 'type') || '')) { gone.add(q[4]); cats.push([rid, so, sn, q[4]]); }
        // SBML's reference: the one naming that alias, else the first of that species naming none
        var ls = T.span('<' + R[2] + '>', s[0], s[1]), hit = null, first = null, i0 = ls ? ls[0] : 0, sr, al;
        while (ls && (sr = T.span('<' + R[3] + ' ', i0, ls[1]))) {
          i0 = sr[1];
          if (done.has(sr[0])) continue;
          al = /<celldesigner:alias>([^<]*)<\/celldesigner:alias>/.exec(T.t.slice(sr[0], sr[1]));
          if (al && al[1] === old) { hit = [sr, al]; break; }
          if (!al && !first && T.t.slice(sr[0], T.t.indexOf('>', sr[0])).indexOf(' species="' + so + '"') >= 0) first = [sr, null];
        }
        hit = hit || first;
        if (!hit) return;
        done.add(hit[0][0]);
        T.attrs(hit[0][0], [['species', sn]]);
        if (hit[1]) { var at = hit[0][0] + hit[1].index + '<celldesigner:alias>'.length; T.put(at, at + old.length, a); }
      });
      // a catalysis moved: the old species no longer catalyses the reaction unless another of its catalyses stays
      cats.forEach(function (c) {
        if (c[0] === rid && c.length === 4) c.push(r.mods.some(function (m) { return !gone.has(m.el) && sp(m.alias) === c[1] && CAT.test(get(m.el, 'type') || ''); }));
      });
    });
    // the species' lists of the reactions they catalyse, only where the old species listed it (the file keeps them)
    var LIST = '<celldesigner:listOfCatalyzedReactions>', spanOf = function (sid) { return T.span('<species [^>]*\\bid="' + reEscape(sid) + '"'); };
    var listed = function (sid) {
      var s = spanOf(sid), l = s ? T.span(LIST, s[0], s[1]) : null, re = /<celldesigner:catalyzed reaction="([^"]*)"\/>/g, m, out = [];
      if (l) { var body = T.t.slice(l[0], l[1]); while ((m = re.exec(body))) out.push(m[1]); }
      return [s, l, out];
    };
    var lists = new Map();
    cats.forEach(function (c) {
      if (listed(c[1])[2].indexOf(c[0]) < 0) return;
      [c[1], c[2]].forEach(function (x) { if (!lists.has(x)) lists.set(x, listed(x)[2].slice()); });
      if (!c[4]) lists.set(c[1], lists.get(c[1]).filter(function (x) { return x !== c[0]; }));
      if (lists.get(c[2]).indexOf(c[0]) < 0) lists.get(c[2]).push(c[0]);
    });
    lists.forEach(function (list, sid) {
      var L = listed(sid), s = L[0], l = L[1];
      if (!s || list.join() === L[2].join()) return;
      var body = LIST + list.map(function (x) { return '\n<celldesigner:catalyzed reaction="' + x + '"/>'; }).join('') + '\n</celldesigner:listOfCatalyzedReactions>';
      if (l && !list.length) T.put(l[0], l[1] + (T.t.slice(l[1], l[1] + 1) === '\n' ? 1 : 0), '');
      else if (l) T.put(l[0], l[1], body);
      else { var at = T.t.indexOf('</celldesigner:extension>', s[0]); if (at >= 0 && at < s[1]) T.put(at, at, body + '\n'); }
    });
    return T.done();
  }
  var MARGIN = 40.0, GATE_ID = /\|g\d*$/;
  function gatesOf(boxes, old, nw) { boxes.forEach(function (b, i) { if (!old.has(i) && GATE_ID.test(i)) nw.set(i, b); }); }   // the gates' nodes, for reaction()
  function apply(t, gtext, opt) { return place(t, gtext, opt)[0]; }
  // one reaction's lines written into T (s: its span), as place does for each (also the editor's live drawing, live():
  // JavaScript only, it changes no text; cd_edit.py keeps this inside place)
  // a gate's place now: the centre of its node, if the editor moved it (nw), else where it was
  function gateAt(nw, id, G) { var b = nw.get(id); if (!b) return G; var c = [b[0] + b[2] / 2, b[1] + b[3] / 2]; return near(c, G, 1e-6) ? G : c; }
  // a gate's editPoints: the bends of its line to the target (frame from G to the target), then its place
  function gatePoints(old, o, G, nb, same, fr) {
    var toks = (old || '').trim().split(/\s+/).filter(function (q) { return q; }), last = toks.pop();
    var bt = points(toks.join(' '), o.bends, nb, same, fr);
    return (bt ? bt + ' ' : '') + (last && near(G, o.G, 1e-6) ? last : num(G[0]) + ',' + num(G[1]));
  }
  // a gate's line's directions, counted again only when its bends changed in number (files written elsewhere may hold more)
  function scheme(T, sp, n, n0) { var c = n !== n0 ? T.span('<celldesigner:connectScheme', sp[0], sp[1]) : null; if (c) directions(T, c, n + 1); }
  function gateBack(d, T, s, o, bends, nw) {   // a gate between entities written back
    var rid = o.id, G = gateAt(nw, rid + '|g', o.G), pb = find(o.x, 'cd:baseProducts/cd:baseProduct'), B = d.end(pb, o.pa)[0];
    var nb = bends.has(rid + '|a') ? bends.get(rid + '|a') : o.bends;
    var ep = gatePoints(get(o.el, 'editPoints'), o, G, nb, near(G, o.G, 1e-6) && near(B, o.B, 1e-6), function (p) { return toFrame(G, B, p); });
    var ls = T.span('<celldesigner:listOfGateMember>', s[0], s[1]), top = nth(T, '<celldesigner:GateMember ', ls, o.top);
    T.attrs(top[0], [['editPoints', ep]]);
    scheme(T, top, nb.length, o.bends.length);
    var re = T.span('<celldesigner:editPoints>', s[0], ls[0]);   // the reaction's own copy of the gate's points
    if (re) T.put(re[0], re[1], '<celldesigner:editPoints>' + ep + '</celldesigner:editPoints>');
    o.ins.forEach(function (q) {
      var M = d.end(find(q.el, 'cd:linkTarget'), q.alias)[0], k = rid + '|i' + q.n, nb2 = bends.has(k) ? bends.get(k) : q.bends;
      var tx = points(get(q.el, 'editPoints'), q.bends, nb2, near(M, q.M, 1e-6) && near(G, o.G, 1e-6), function (p) { return toFrame(M, G, p); });
      var sp = nth(T, '<celldesigner:GateMember ', ls, q.n);
      T.attrs(sp[0], [['editPoints', tx || null]]);
      scheme(T, sp, nb2.length, q.bends.length);
    });
  }
  function reaction(d, T, s, rx, o, bends, paths, nw) {
    var rid = o.id;
    ports(d, T, s, o, paths, nw);
    if (o.gate) { gateBack(d, T, s, o, bends, nw); return; }
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
      if (main.length !== o.bends.length) directions(T, cs, main.length + 1);   // counted again only when the bends changed in number (a file written elsewhere may hold more)
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
    var Gs = o.gates.map(function (g) {
      if (g.n >= modSpans.length) throw new Error('IndexError: list index out of range');
      var G = gateAt(nw, rid + '|g' + g.n, g.G), Tt = target(g.el, sq, fl), ms = modSpans[g.n], nb = bends.has(rid + '|m' + g.n) ? bends.get(rid + '|m' + g.n) : g.bends;
      var ep = gatePoints(get(g.el, 'editPoints'), g, G, nb, near(G, g.G, 1e-6) && near(Tt, g.T, 1e-6), function (p) { return toFrame(G, Tt, p); });
      T.attrs(ms[0], [['targetLineIndex', get(g.el, 'targetLineIndex')], ['editPoints', ep]]);
      scheme(T, ms, nb.length, g.bends.length);
      return G;
    });
    o.mods.forEach(function (mo) {
      if (mo.n >= modSpans.length) throw new Error('IndexError: list index out of range');
      var ms = modSpans[mo.n], M = d.end(find(mo.el, 'cd:linkTarget'), mo.alias)[0], Tt = mo.gate !== null ? Gs[mo.gate] : target(mo.el, sq, fl);
      var nb = bends.has(rid + '|m' + mo.n) ? bends.get(rid + '|m' + mo.n) : mo.bends, same = near(M, mo.M, 1e-6) && near(Tt, mo.T, 1e-6);
      var tx = points(get(mo.el, 'editPoints'), mo.bends, nb, same, function (p) { return toFrame(M, Tt, p); });
      T.attrs(ms[0], [['targetLineIndex', get(mo.el, 'targetLineIndex')], ['editPoints', tx || null]]);   // its place, if ports() moved it
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
      for (var si = 0; si < subs.length && !ls; si++) if (T.span('<celldesigner:' + tag + ' ', subs[si][0], subs[si][1])) ls = nth(T, '<celldesigner:' + tag + ' ', subs[si], l.n);
      if (!ls) return;
      var child = T.span('<celldesigner:editPoints>', ls[0], ls[1]);
      if (child && tx) T.put(child[0], child[1], '<celldesigner:editPoints>' + tx + '</celldesigner:editPoints>');
      else if (child) T.put(child[0], child[1] + (T.t.slice(child[1], child[1] + 1) === '\n' ? 1 : 0), '');   // its last bend point gone: the element goes, as the main line's
      else T.attrs(ls[0], [['editPoints', tx || null]]);
      var c3 = T.span('<celldesigner:connectScheme', ls[0], ls[1]);
      if (c3) directions(T, c3, nb.length + 1);
    });
  }
  function place(t, gtext, opt) {
    var d = drawing(t, opt), rd = read(gtext, opt), rxsAll = findall(d.model, 's:listOfReactions/s:reaction'), olds = {};
    rxsAll.forEach(function (rx) { olds[get(rx, 'id')] = lines(d, rx); });
    var t2 = rewire(d, t, rd[4], olds);
    if (t2 !== t) {   // a line's end moved to another node: the participant first, then read again
      t = t2; d = drawing(t, opt); rxsAll = findall(d.model, 's:listOfReactions/s:reaction'); olds = {};
      rxsAll.forEach(function (rx) { olds[get(rx, 'id')] = lines(d, rx); });
    }
    var comps = compartments(d), up = tree(d, comps), boxes = rd[0], bends = rd[2], paths = rd[3];
    var xs = [], ys = [];
    boxes.forEach(function (b) { xs.push(b[0]); ys.push(b[1]); });
    bends.forEach(function (ps) { ps.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    // opt.fit (JavaScript only): the canvas fitted round the map, what is drawn moved by whole grid blocks so its top
    // left lies MARGIN to MARGIN + 16 from the corner, the canvas MARGIN past its right and bottom (free texts counted too)
    var fit = !!(opt && opt.fit), lyB = [];
    if (fit) {
      var lyS = /<celldesigner:listOfLayers>[\s\S]*?<\/celldesigner:listOfLayers>/.exec(t), reB = /<celldesigner:bounds ([^>]*)>/g, mB;
      while (lyS && (mB = reB.exec(lyS[0]))) {   // a free text's x, y, w, h, a free line's two ends sx, sy, ex, ey
        var vB = {}, reV = /\s((?:[se])?[xy]|[wh])="([^"]*)"/g, mV;
        while ((mV = reV.exec(' ' + mB[1]))) vB[mV[1]] = F(mV[2]);
        if (isFinite(vB.x) && isFinite(vB.y)) lyB.push([vB.x, vB.y, vB.x + (vB.w || 0), vB.y + (vB.h || 0)]);
        if (isFinite(vB.sx) && isFinite(vB.sy) && isFinite(vB.ex) && isFinite(vB.ey)) lyB.push([Math.min(vB.sx, vB.ex), Math.min(vB.sy, vB.ey), Math.max(vB.sx, vB.ex), Math.max(vB.sy, vB.ey)]);
      }
      lyB.forEach(function (b) { xs.push(b[0]); ys.push(b[1]); });
    }
    var block = function (m) { return fit ? Math.ceil((MARGIN - m) / 16) * 16.0 || 0.0 : m < 0 ? Math.ceil((MARGIN - m) / 16) * 16.0 : 0.0; };
    var mn = function (a) { return a.reduce(function (p, v) { return v < p ? v : p; }, Infinity); };
    var sh = [xs.length ? block(mn(xs)) : 0.0, ys.length ? block(mn(ys)) : 0.0], shifted = sh[0] !== 0 || sh[1] !== 0;
    if (shifted) {
      var nb = new Map(); boxes.forEach(function (b, i) { nb.set(i, [b[0] + sh[0], b[1] + sh[1], b[2], b[3]]); }); boxes = nb;
      var nbe = new Map(); bends.forEach(function (ps, i) { nbe.set(i, ps.map(function (p) { return [p[0] + sh[0], p[1] + sh[1]]; })); }); bends = nbe;
    }
    var old = new Map();
    d.alias.forEach(function (a, i) { old.set(i, a[1]); });
    comps.forEach(function (v, c) { old.set(c, v[0]); });
    var T = new Text(t), nw = new Map(), ups = rd[1];
    var regrouped = function (i) { if (!ups.has(i)) return false; var q = ups.get(i); return q !== (up.has(i) ? up.get(i) : null) && (q === null || comps.has(q)) && !comps.has(i) && get(d.alias.get(i)[2], 'complexSpeciesAlias') === null; };   // its compartment set in the editor (written below)
    old.forEach(function (b, i) { nw.set(i, boxes.has(i) ? boxes.get(i) : b); });
    gatesOf(boxes, old, nw);
    old.forEach(function (b, i) {
      var n = nw.get(i);
      if ([0, 1, 2, 3].every(function (j) { return Math.abs(n[j] - b[j]) < 1e-3; })) return;
      var kind = comps.has(i) ? 'compartmentAlias' : d.alias.get(i)[0] === 'COMPLEX' ? 'complexSpeciesAlias' : 'speciesAlias';
      var s = T.span('<celldesigner:' + kind + ' id="' + reEscape(i) + '"');
      if (!s) throw new Error("TypeError: 'NoneType' object is not subscriptable");
      var bt = T.span('<celldesigner:bounds ', s[0], s[1]);
      T.attrs(bt[0], ['x', 'y', 'w', 'h'].map(function (k, j) { return [k, j]; }).filter(function (q) { return Math.abs(n[q[1]] - b[q[1]]) >= 1e-3; }).map(function (q) { return [q[0], num(n[q[1]])]; }));
      // a species resized: its usual view's boxSize the same as its bounds (CellDesigner keeps both)
      var uv = !comps.has(i) && (Math.abs(n[2] - b[2]) >= 1e-3 || Math.abs(n[3] - b[3]) >= 1e-3) && T.span('<celldesigner:usualView>', s[0], s[1]), bs = uv && T.span('<celldesigner:boxSize ', uv[0], uv[1]);
      if (bs) T.attrs(bs[0], [['width', num(n[2])], ['height', num(n[3])]]);
      var p = up.has(i) ? up.get(i) : null, ip = T.span('<celldesigner:innerPosition ', s[0], s[1]);
      if (ip && p !== null && !regrouped(i)) {
        var v = {}, re = /\s([xy])="([^"]*)"/g, mm, seg = T.t.slice(ip[0], ip[1]);
        while ((mm = re.exec(seg))) v[mm[1]] = F(mm[2]);
        if (!has(v, 'x') || !has(v, 'y')) throw new Error('KeyError: x');
        var pb = old.get(p), pn = nw.get(p);
        if (Math.abs(v.x - (b[0] - pb[0])) < 1e-3 && Math.abs(v.y - (b[1] - pb[1])) < 1e-3)
          T.attrs(ip[0], ['x', 'y'].map(function (k, j) { return [k, j]; }).filter(function (q) { return Math.abs((n[q[1]] - pn[q[1]]) - (b[q[1]] - pb[q[1]])) >= 1e-3; }).map(function (q) { return [q[0], num(n[q[1]] - pn[q[1]])]; }));
      }
      if (comps.has(i)) {
        // its name moved with its corner; a name at one of the nine places, or at the top middle (cdrender.nameLeft), kept there, the box resized too
        var npt = T.span('<celldesigner:namePoint ', s[0], s[1]);
        if (npt && n.some(function (v, j) { return Math.abs(v - b[j]) >= 1e-3; })) {
          var mv = {}, re2 = /\s([xy])="([^"]*)"/g, m2, seg2 = T.t.slice(npt[0], npt[1]);
          while ((m2 = re2.exec(seg2))) mv[m2[1]] = m2[2];
          var ctag = T.t.slice(s[0], T.t.indexOf('>', s[0])), cid = (/\scompartment="([^"]*)"/.exec(ctag) || [])[1];
          var cs = cid && T.span('<compartment(?=\\s)[^>]*\\sid="' + reEscape(cid) + '"'), cn = cs && /\sname="([^"]*)"/.exec(T.t.slice(cs[0], T.t.indexOf('>', cs[0])));
          var cname = (cn ? cn[1] : cid || '').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
          // a name at one of the nine places (cdrender.namePoint) kept at its place in the new box
          var dl = /<celldesigner:doubleLine\s(?:[^>]*\s)?thickness="([^"]*)"/.exec(T.t.slice(s[0], s[1])), th = dl ? F(dl[1]) : 12;
          var ov = /<celldesigner:class>OVAL</.test(T.t.slice(s[0], s[1])), pl = cdr.namePlaceOf(b, cname, th, [F(mv.x), F(mv.y)], ov, true), at = pl && cdr.namePoint(n, cname, th, pl, ov);
          var mid = !pl && Math.abs(F(mv.x) - cdr.nameLeft(b, cname)) < 1;
          if (at) T.attrs(npt[0], [['x', num(at[0])], ['y', num(at[1])]]);
          else if (mid || Math.abs(n[0] - b[0]) >= 1e-3 || Math.abs(n[1] - b[1]) >= 1e-3)
            T.attrs(npt[0], [['x', num(mid ? cdr.nameLeft(n, cname) : F(mv.x) + n[0] - b[0])], ['y', num(F(mv.y) + n[1] - b[1])]]);
        }
      }
    });
    // what holds what as the editor set it: an alias or a complex the GraphML
    // puts into another compartment, or none, gets that compartment as its compartmentAlias (none: the attribute taken off)
    // and its species that compartment's own (default for none), as CellDesigner 4.4 writes them; a compartment put into
    // another gets that one's compartment as its outside. A complex's member stays as the file has it (one taken out is
    // written by cd_make.leave after this)
    var cid = function (c) { return c === null ? 'default' : get(comps.get(c)[1], 'compartment'); }, spDone = new Set();
    old.forEach(function (b, i) {
      if (!ups.has(i)) return;
      var p = ups.get(i), was = up.has(i) ? up.get(i) : null;
      if (p === was || (p !== null && !comps.has(p))) return;
      if (comps.has(i)) {
        var mc = T.span('<compartment [^>]*\\bid="' + reEscape(cid(i)) + '"');
        if (mc && (p !== null || /\soutside="/.test(T.t.slice(mc[0], T.t.indexOf('>', mc[0]))))) T.attrs(mc[0], [['outside', cid(p)]]);
        return;
      }
      var A = d.alias.get(i)[2], sid = get(A, 'species');
      if (get(A, 'complexSpeciesAlias') !== null) return;
      var s = T.span('<celldesigner:' + (d.alias.get(i)[0] === 'COMPLEX' ? 'complexSpeciesAlias' : 'speciesAlias') + ' id="' + reEscape(i) + '"');
      T.attrs(s[0], [['compartmentAlias', p]]);
      var ip2 = T.span('<celldesigner:innerPosition ', s[0], s[1]);   // its offset from the new compartment's corner, as CellDesigner writes it when it reassigns
      if (ip2 && p !== null) T.attrs(ip2[0], [['x', num(nw.get(i)[0] - nw.get(p)[0])], ['y', num(nw.get(i)[1] - nw.get(p)[1])]]);
      if (d.alias.get(i)[0] === 'COMPLEX') carriers(T.t, i).forEach(function (q) {   // its members that carry a compartmentAlias (CellDesigner writes their complex's): the new one
        if (q[1] !== p) T.attrs(T.span('<celldesigner:' + q[2] + ' id="' + reEscape(q[0]) + '"')[0], [['compartmentAlias', p]]);
      });
      var sp = spDone.has(sid) ? null : T.span('<species [^>]*\\bid="' + reEscape(sid) + '"');
      spDone.add(sid);
      if (sp) T.attrs(sp[0], [['compartment', cid(p)]]);
    });
    // where a species lies in its compartment, as CellDesigner 4.4 writes it:
    // inside, or transmembrane when its alias crosses the border (inside when it leaves every compartment); written only
    // where a move or a change of compartment changes it, and only where the file has the element
    var posDone = new Set(), olap = function (b, c) { return b[0] < c[0] + c[2] && c[0] < b[0] + b[2] && b[1] < c[1] + c[3] && c[1] < b[1] + b[3]; };
    var state = function (b, c) { return inside(b, c) ? 'inside' : olap(b, c) ? 'transmembrane' : null; };
    d.alias.forEach(function (A, i) {
      if (get(A[2], 'complexSpeciesAlias') !== null) return;
      var p0 = up.has(i) ? up.get(i) : null, p1 = ups.has(i) && (ups.get(i) === null || comps.has(ups.get(i))) ? ups.get(i) : p0, sid = get(A[2], 'species');
      if ((p1 !== null && !comps.has(p1)) || (p1 === null && p0 === null) || posDone.has(sid)) return;
      var now = p1 === null ? 'inside' : state(nw.get(i), nw.get(p1)), then = p0 !== null && comps.has(p0) ? state(old.get(i), old.get(p0)) : null;   // out of every compartment: inside the default one
      if (now === null || (now === then && p0 === p1)) return;
      var sp = T.span('<species [^>]*\\bid="' + reEscape(sid) + '"'), pc = sp ? T.search('<celldesigner:positionToCompartment>([^<]*)</celldesigner:positionToCompartment>', sp[0], sp[1]) : null;
      posDone.add(sid);
      if (pc && pc[1] !== now) T.put(pc.index + '<celldesigner:positionToCompartment>'.length, pc.index + '<celldesigner:positionToCompartment>'.length + pc[1].length, now);
    });
    var far = [-Infinity, -Infinity];
    nw.forEach(function (n) { far[0] = Math.max(far[0], n[0] + n[2]); far[1] = Math.max(far[1], n[1] + n[3]); });
    var md = T.span('<celldesigner:modelDisplay ');
    if (md && fit && far[0] > -Infinity) {
      bends.forEach(function (ps) { ps.forEach(function (p) { far[0] = Math.max(far[0], p[0]); far[1] = Math.max(far[1], p[1]); }); });
      lyB.forEach(function (b) { far[0] = Math.max(far[0], b[2] + sh[0]); far[1] = Math.max(far[1], b[3] + sh[1]); });
      var fW = String(Math.ceil(far[0] + MARGIN)), fH = String(Math.ceil(far[1] + MARGIN));
      if (F(fW) !== d.W || F(fH) !== d.H) T.attrs(md[0], [['sizeX', fW], ['sizeY', fH]]);
    } else if (md && (far[0] > d.W || far[1] > d.H))
      T.attrs(md[0], [['sizeX', far[0], d.W], ['sizeY', far[1], d.H]].filter(function (q) { return q[1] > q[2]; }).map(function (q) { return [q[0], String(Math.ceil(q[1] + 40))]; }));
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
        var tg = T.t.slice(ly[0] + m4.index, T.t.indexOf('>', ly[0] + m4.index)), v2 = {}, re4 = /\s((?:[se])?[xy])="([^"]*)"/g, m5;
        while ((m5 = re4.exec(tg))) v2[m5[1]] = m5[2];
        // a free text's corner, a free line's two ends
        T.attrs(ly[0] + m4.index, ['x', 'y', 'sx', 'sy', 'ex', 'ey'].filter(function (k) { return has(v2, k); }).map(function (k) { return [k, num(F(v2[k]) + sh[/y$/.test(k) ? 1 : 0])]; }));
      }
      // the gates reaction() did not write (their reactions not read by lines())
      var own = rxsAll.filter(function (rx) { var o = olds[get(rx, 'id')]; return o && (o.gate || o.gates.length); }).map(function (rx) { return T.span('<reaction [^>]*\\bid="' + reEscape(get(rx, 'id')) + '"'); });
      var re5 = /<celldesigner:(?:GateMember|modification) [^>]*type="BOOLEAN_LOGIC_GATE[^>]*>/g, m6;
      while ((m6 = re5.exec(T.t))) {
        if (own.some(function (q) { return q[0] <= m6.index && m6.index < q[1]; })) continue;
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
  // the aliases inside complex alias cx, nested ones too, that carry a compartmentAlias: [[id, that alias, its tag's name], ...]
  // (place() and cd_make.js's compartment() set it to their complex's; cd_edit.py's members() its twin)
  function carriers(t, cx) {
    var tags = [], re = /<celldesigner:(complexSpeciesAlias|speciesAlias)(?=\s)[^>]*>/g, m, out = [], at = function (tag, k) { var r = new RegExp('\\s' + k + '="([^"]*)"').exec(tag); return r ? r[1] : null; };
    while ((m = re.exec(t))) tags.push([m[0], m[1]]);
    (function walk(c) {
      tags.forEach(function (q) {
        if (at(q[0], 'complexSpeciesAlias') !== c) return;
        var id = at(q[0], 'id'), ca = at(q[0], 'compartmentAlias');
        if (ca !== null) out.push([id, ca, q[1]]);
        walk(id);
      });
    })(cx);
    return out;
  }
  // the editor's check before it changes what holds what on a CellDesigner map (JavaScript only): why
  // the file cannot hold the moves ([[node id, parent node id or null], ...]), or null. A move goes into a compartment or
  // none (a complex's member taken out is written by cd_make.leave, a species into a complex by cd_make.join); every
  // alias of a species stays in one compartment, as CellDesigner keeps a species in one
  function nestCheck(t, moves, opt) {
    var d = drawing(t, opt), comps = compartments(d), to = new Map(), why = null;
    moves.forEach(function (m) { to.set(m[0], m[1]); });
    moves.some(function (m) {
      var i = m[0], p = m[1], A = d.alias.get(i);
      if (!A) return false;
      var nm = '"' + (typeof A[3] === 'string' ? cdr.plainName(A[3]) : get(A[2], 'species')) + '"', sid = get(A[2], 'species');
      if (p !== null && !comps.has(p)) { why = nm + ' goes into a complex only when dropped on it.'; return true; }
      d.alias.forEach(function (B, j) {
        if (why || j === i || get(B[2], 'species') !== sid) return;
        var q = to.has(j) ? to.get(j) : comps.has(get(B[2], 'compartmentAlias')) ? get(B[2], 'compartmentAlias') : null;
        if (q !== p) why = nm + ' is drawn more than once, and CellDesigner keeps every copy of a species in one compartment: move the copies together.';
      });
      return !!why;
    });
    return why;
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

  // the editor's live drawing of a move (during a drag the reactions follow the nodes, not only after the
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
      // ends: the lines whose end is over another node, by edge id [source, target] (the GraphML's ends), written into the
      // reaction first as the drop's rewire() writes them, so the line is drawn as it will be after the drop
      frame: function (boxes, bends, paths, rids, ends) {
        var nw = new Map(), B = new Map(rd[2]), P = new Map(rd[3]), out = {};
        // the boxes as place() takes them to write the lines (nw), and as it writes them into the file (six decimals),
        // which the drawing after the drop reads (fl)
        var fl = new Map();
        old.forEach(function (b, i) {
          var n = boxes.has(i) ? boxes.get(i) : b; nw.set(i, n);
          fl.set(i, n === b ? b : n.map(function (v, j) { return Math.abs(v - b[j]) < 1e-3 ? b[j] : F(num(v)); }));
        });
        gatesOf(boxes, old, nw);
        var ids = Array.from(new Set(Array.from(boxes.keys()).concat(last))).filter(function (i) { return alias0.has(i); });
        var put = function (m) { ids.forEach(function (i) { var a0 = alias0.get(i); d.alias.set(i, [a0[0], m.get(i), a0[2], a0[3], a0[4]]); }); };
        last = Array.from(boxes.keys());
        bends.forEach(function (v, k) { B.set(k, v); });
        paths.forEach(function (v, k) { P.set(k, v); });
        rids.forEach(function (rid) {
          var sl = slice(rid);
          if (!olds[rid] || !sl) { out[rid] = null; return; }
          try {
            var mine = new Map();
            if (ends) ends.forEach(function (v, k) { if (k.indexOf(rid + '|') === 0) mine.set(k, v); });
            if (mine.size) { var o1 = {}; o1[rid] = olds[rid]; sl = rewire(d, sl, mine, o1); }
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
      // a compartment or a species alias drawn at box by cdrender's own code (the editor's holders growing during a drag:
      // compartments and complexes): what its group holds, as text; null for an id that is neither
      holder: function (id, box) {
        d.out = [];
        if (comps.has(id)) d.compartment(comps.get(id)[1], box);
        else if (alias0.has(id)) {
          var a = d.alias.get(id);
          d.alias.set(id, [a[0], box, a[2], a[3], a[4]]);
          try { d.node(id); } finally { d.alias.set(id, a); }
        } else return null;
        return d.out.join('\n');
      },
      rest: function (rid) {   // where the reaction's glyph is on the drawing read: [sq, angle, length]
        var o = olds[rid];
        return o && o.glyph ? [o.sq, Math.atan2(o.fl[1], o.fl[0]), Math.hypot(o.Q[0] - o.P[0], o.Q[1] - o.P[1])] : null;
      }
    };
  }

  // Make main (JavaScript only, the editor's and tests/cd-make-main.js's one master): in cd_edit's
  // GraphML g the added reactant's or product's line linkId ('<reaction>|r<n>' or '|p<n>') and the main one ('|a' or
  // '|b') trade their species end, their port there and their bend points, so each species keeps its line's route and
  // only the roles change; place() then writes the participants. null when it cannot be done: not such a line, or its
  // species is already another reactant's or product's of the reaction (rewire would refuse it)
  function makeMain(g, linkId) {
    var m = /^(.*\|)([rp])\d+$/.exec(linkId);
    if (!m) return null;
    var into = m[2] === 'r', mainId = m[1] + (into ? 'a' : 'b'), att = into ? 'source' : 'target', xy = into ? ['sx', 'sy'] : ['tx', 'ty'];
    var blocks = {}, re = /<edge\b[\s\S]*?<\/edge>/g, b;
    while ((b = re.exec(g))) { var id = /\sid="([^"]*)"/.exec(b[0]); if (id && id[1].indexOf(m[1]) === 0) blocks[id[1]] = [b.index, b[0]]; }
    var A = blocks[mainId], B = blocks[linkId];
    if (!A || !B) return null;
    var attr = function (t, k) { var r = new RegExp('\\s' + k + '="([^"]*)"').exec(t); return r ? r[1] : null; };
    var put = function (t, k, v) {
      var r = new RegExp('(\\s' + k + '=")[^"]*"');
      if (v == null) return t.replace(new RegExp('\\s' + k + '="[^"]*"'), function () { return ''; });
      return r.test(t) ? t.replace(r, function (x, p1) { return p1 + v + '"'; }) : t.replace(/(\/?>)$/, function (x) { return ' ' + k + '="' + v + '"' + x; });
    };
    var tag = function (blk) { return /^<edge\b[^>]*>/.exec(blk)[0]; }, nodeOf = function (blk) { return attr(tag(blk), att); };
    var other = Object.keys(blocks).some(function (id) { return id !== mainId && id !== linkId && !/\|m\d+$/.test(id) && [attr(tag(blocks[id][1]), 'source'), attr(tag(blocks[id][1]), 'target')].indexOf(nodeOf(B[1])) >= 0; });
    if (other || nodeOf(A[1]) === nodeOf(B[1])) return null;
    var path = function (blk) { return /<y:Path\b[^>]*?(\/>|>[\s\S]*?<\/y:Path>)/.exec(blk); };
    var pa = path(A[1]), pb = path(B[1]);
    if (!pa || !pb) return null;
    var head = function (p) { return /^<y:Path\b[^>]*?\/?>/.exec(p)[0]; }, pts = function (p) { return p.slice(head(p).length).replace(/<\/y:Path>$/, ''); };
    var mk = function (p, from) {   // p with the port at the species and the bend points of from
      var h = head(p).replace(/\/>$/, '>'), body = pts(from[0]);
      xy.forEach(function (k) { h = put(h, k, attr(head(from[0]), k)); });
      return body.trim() ? h + body + '</y:Path>' : h.replace(/>$/, '/>');
    };
    var swap = function (blk, p, from, end) {
      var t = tag(blk), rest = blk.slice(t.length), at = p.index - t.length;
      return put(t, att, end) + rest.slice(0, at) + mk(p[0], from) + rest.slice(at + p[0].length);
    };
    var A2 = swap(A[1], pa, pb, nodeOf(B[1])), B2 = swap(B[1], pb, pa, nodeOf(A[1]));
    var parts = [[A[0], A[1], A2], [B[0], B[1], B2]].sort(function (x, y) { return y[0] - x[0]; });
    parts.forEach(function (q) { g = g.slice(0, q[0]) + q[2] + g.slice(q[0] + q[1].length); });
    return g;
  }
  var api = { graphml: graphml, place: place, apply: apply, draw: draw, live: live, lines: lines, drawing: drawing, makeMain: makeMain,   // lines, drawing: for tests/cd-square.js
    Text: Text, reEscape: reEscape, inside: inside, nestCheck: nestCheck, carriers: carriers };   // the text splicing and box test, for cd_make.js; nestCheck for the editor
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.cd_edit = api;
})(typeof window !== 'undefined' ? window : globalThis);
