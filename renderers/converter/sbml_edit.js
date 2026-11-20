// sbml_edit: an SBML file with a layout edited as the GraphML the converter makes of it (mapconv/sbml.py: read, then
// graphml.write), layout only, as sbgn_edit does for SBGN-ML. The converter keeps the glyph ids as the node ids and the
// species reference glyph ids as the edge ids; a node's centre is its glyph's centre (a source or sink, or a species
// given as a point, drawn larger round it; a reaction at its curve's middle, else its box's centre, else amid its
// species), so the two files map number for number:
//   graphml(sbmlText, baseGraphml, opt) -> the GraphML of sbmlText, made from baseGraphml (the converter's GraphML of a
//     version of the same file, moves apart): each node at its glyph's centre (a compartment at its box), each line's
//     bend points the inner points of its curve; the rest of baseGraphml byte for byte. graphml(s, conv(s)) is conv(s).
//   write(sbmlText, graphmlText, opt) -> sbmlText with the places of graphmlText: only the numbers that change (a
//     glyph's position, a compartment's size, a text glyph with its glyph, a reaction's curve with its process, a line's
//     ends with what they join and its bend points), the rest byte for byte, so other tools open it as before. A reaction
//     the file gives no place (drawn amid its species) gets one, as a point, once it is drawn elsewhere; where its glyph
//     has no box at all, a box of 0 by 0 is put in for it.
//     write(s, conv(s)) is s. A line whose bend points changed in number is written as straight segments.
//   mapKind(t), isAf(t): 'af' for an SBML-qual model, else 'pd' (layout only: nothing is made or retyped).
// Lines the file does not draw (SBML-qual influences, a reaction glyph's lines taken from its reaction) keep no bend.
// tests/sbml-edit.js checks both ways against the converter on every SBML file of the demo, also after made-up moves.
(function (root) {
  'use strict';
  var S = typeof require === 'function' && typeof module !== 'undefined' ? require('./sbgn_edit.js') : root.sbgn_edit;
  var Tags = S.Tags, repr = S.repr, num = S.num;
  function DP(opt) { return (opt && opt.DOMParser) || root.DOMParser; }
  function ln(e) { return e.localName || String(e.nodeName).replace(/^.*:/, ''); }
  function kids(el, name) { var out = []; for (var c = el && el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && (!name || ln(c) === name)) out.push(c); return out; }
  function kid(el, name) { return kids(el, name)[0] || null; }
  function all(el, name) { var out = [], l = el.getElementsByTagName('*'); for (var i = 0; i < l.length; i++) if (ln(l[i]) === name) out.push(l[i]); return out; }
  function an(el, k) {   // an attribute's qualified name by its local name (layout:x or x), or null
    if (!el) return null;
    for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if ((a.localName || a.name.replace(/^.*:/, '')) === k) return a.name; }
    return null;
  }
  function av(el, k) { var n = an(el, k); return n ? el.getAttribute(n) : null; }
  function F(v) { var x = parseFloat(v); return isNaN(x) ? 0 : x; }
  var NEAR = 0.01;
  function same(p, q) { return Math.abs(p[0] - q[0]) < NEAR && Math.abs(p[1] - q[1]) < NEAR; }

  function parse(t, opt) {
    var doc = new (DP(opt))().parseFromString(t.replace(/^﻿/, ''), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('not a readable SBML file');
    return doc;
  }
  // the file's first layout, its glyphs by id
  function layoutOf(doc) {
    var lay = all(doc.documentElement, 'layout')[0];
    if (!lay) throw new Error('no layout in this SBML file');
    var by = {};
    ['compartmentGlyph', 'speciesGlyph', 'generalGlyph', 'reactionGlyph', 'textGlyph', 'speciesReferenceGlyph'].forEach(function (k) {
      all(lay, k).forEach(function (g) { var i = av(g, 'id'); if (i) by[i] = g; });
    });
    by._text = {};   // a glyph's first text glyph's own text (the reader's label, where it is one)
    all(lay, 'textGlyph').forEach(function (t) { var o = av(t, 'graphicalObject'), v = av(t, 'text'); if (o && !(o in by._text)) by._text[o] = v || (av(t, 'originOfText') ? 'named' : ''); });
    return { lay: lay, by: by };
  }
  function boxEl(g) { var b = kid(g, 'boundingBox'); return b ? { b: b, p: kid(b, 'position'), d: kid(b, 'dimensions') } : null; }
  function box(g) {   // x, y, w, h (no dimensions: a point)
    var e = boxEl(g);
    if (!e || !e.p) return null;
    return [F(av(e.p, 'x')), F(av(e.p, 'y')), e.d ? F(av(e.d, 'width')) : 0, e.d ? F(av(e.d, 'height')) : 0];
  }
  // a curve's points as the reader takes them (each segment's start and end, a repeat dropped), each with the elements
  // that give it (a segment's end and the next one's start are one point)
  function curve(g) {
    var c = kid(g, 'curve'), l = c && kid(c, 'listOfCurveSegments'), segs = l ? kids(l, 'curveSegment') : [], pts = [], els = [];
    segs.forEach(function (s) {
      ['start', 'end'].forEach(function (k) {
        var e = kid(s, k);
        if (!e || av(e, 'x') == null || av(e, 'y') == null) return;
        var p = [F(av(e, 'x')), F(av(e, 'y'))];
        if (!pts.length || !same(pts[pts.length - 1], p)) { pts.push(p); els.push([e]); }
        else els[els.length - 1].push(e);
      });
    });
    return { list: l, segs: segs, pts: pts, els: els };
  }
  function centre(b) { return [b[0] + b[2] / 2, b[1] + b[3] / 2]; }
  // a glyph's centre as the reader places its node; a reaction with no place, amid the glyphs its lines join
  function placeOf(g, by) {
    if (ln(g) === 'reactionGlyph') {
      var pts = curve(g).pts, b = box(g);
      if (pts.length) return [(pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2];
      if (b && (b[0] || b[1] || b[2] || b[3])) return centre(b);
      var ends = all(g, 'speciesReferenceGlyph').map(function (r) { var s = by[av(r, 'speciesGlyph')]; return s && box(s); }).filter(Boolean);
      if (!ends.length) return null;
      var c = ends.map(centre);
      return [c.reduce(function (a, p) { return a + p[0]; }, 0) / c.length, c.reduce(function (a, p) { return a + p[1]; }, 0) / c.length];
    }
    var bb = box(g);
    if (!bb) return null;
    if (ln(g) === 'speciesGlyph' && (bb[2] < 1 || bb[3] < 1) && !sink(g, by)) return [bb[0], bb[1]];   // a point: the reader centres its glyph on it
    return centre(bb);
  }
  // a species glyph the reader draws as a source or sink: it names no species and no text but COPASI's 'unset' names it
  function sink(g, by) {
    if (av(g, 'species') || av(g, 'metaidRef')) return false;
    var t = by._text && by._text[av(g, 'id')];
    return !t || t === 'unset';
  }

  // ---------- the editor's GraphML ----------
  function gNodes(gtext, opt) {   // id -> [x, y, w, h] of the GraphML's nodes; edge id -> { s, t, pts }
    var doc = parse(gtext, opt), nodes = {}, edges = {};
    all(doc.documentElement, 'node').forEach(function (n) {
      var g = all(n, 'Geometry')[0];
      if (g && !(n.getAttribute('id') in nodes)) nodes[n.getAttribute('id')] = [F(g.getAttribute('x')), F(g.getAttribute('y')), F(g.getAttribute('width')), F(g.getAttribute('height'))];
    });
    all(doc.documentElement, 'edge').forEach(function (e) {
      var p = all(e, 'Path')[0];
      edges[e.getAttribute('id')] = { s: e.getAttribute('source'), t: e.getAttribute('target'), pts: p ? all(p, 'Point').map(function (q) { return [F(q.getAttribute('x')), F(q.getAttribute('y'))]; }) : [] };
    });
    return { nodes: nodes, edges: edges };
  }
  function esc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function reId(i) { return esc(i).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function graphml(t, base, opt) {
    var L = layoutOf(parse(t, opt)), G = gNodes(base, opt), out = base;
    Object.keys(G.nodes).forEach(function (id) {
      var g = L.by[id];
      if (!g) return;
      var b = G.nodes[id], c = placeOf(g, L.by), nb;
      if (!c) return;
      if (ln(g) === 'compartmentGlyph') nb = box(g);
      else nb = [c[0] - b[2] / 2, c[1] - b[3] / 2, b[2], b[3]];
      if (same(nb, b) && same(nb.slice(2), b.slice(2))) return;
      var re = new RegExp('(<node id="' + reId(id) + '"[^>]*>[\\s\\S]*?<y:Geometry )([^>]*?)(/?>)');
      out = out.replace(re, function (m, a, attrs, z) {
        var v = { x: nb[0], y: nb[1], width: nb[2], height: nb[3] };
        return a + attrs.replace(/(\b(x|y|width|height)=")([^"]*)(")/g, function (mm, p, k, old, q) { return F(old) === v[k] ? mm : p + repr(v[k]) + q; }) + z;
      });
    });
    Object.keys(G.edges).forEach(function (id) {
      var r = L.by[id];
      if (!r || ln(r) !== 'speciesReferenceGlyph') return;
      var e = G.edges[id], pts = curve(r).pts;
      if (pts.length < 2) return;
      var sp = av(r, 'speciesGlyph'), s = L.by[sp], sc = s && placeOf(s, L.by);
      if (sc && Math.hypot(pts[pts.length - 1][0] - sc[0], pts[pts.length - 1][1] - sc[1]) < Math.hypot(pts[0][0] - sc[0], pts[0][1] - sc[1])) pts = pts.slice().reverse();
      var inner = pts.slice(1, -1);   // from the species; a line that leaves the process (a product) runs the other way
      if (e.s !== sp) inner.reverse();
      if (inner.length === e.pts.length && inner.every(function (p, k) { return same(p, e.pts[k]); })) return;
      var pt = inner.map(function (p) { return '<y:Point x="' + repr(p[0]) + '" y="' + repr(p[1]) + '"/>'; }).join('');
      var re = new RegExp('(<edge id="' + reId(id) + '"[^>]*>[\\s\\S]*?)<y:Path ([^>]*?)(?:/>|>[\\s\\S]*?</y:Path>)');
      out = out.replace(re, function (m, a, attrs) { return a + '<y:Path ' + attrs.replace(/\s+$/, '') + (pt ? '>' + pt + '</y:Path>' : '/>'); });
    });
    return out;
  }

  // ---------- the moves written into the SBML text ----------
  function write(t, gtext, opt) {
    var doc = parse(t, opt), T = new Tags(t, doc), L = layoutOf(doc), G = gNodes(gtext, opt), d = {}, moved = false;
    var put = new Map();   // a point element -> its new x and y, set once (a curve may hold one element in two roles)
    function setXY(e, x, y) { if (e) put.set(e, [x, y]); }
    function shift(e, v) { if (e && (v[0] || v[1]) && !put.has(e)) put.set(e, [F(av(e, 'x')) + v[0], F(av(e, 'y')) + v[1]]); }
    var POINTS = { start: 1, end: 1, basePoint1: 1, basePoint2: 1 };
    function shiftCurve(g, v) { curve(g).segs.forEach(function (s) { kids(s).forEach(function (p) { if (POINTS[ln(p)]) shift(p, v); }); }); }
    // nodes: each glyph by its centre's move; a compartment by its box
    Object.keys(L.by).forEach(function (id) {
      var g = L.by[id], k = ln(g), nb = G.nodes[id];
      if (!nb || k === 'textGlyph' || k === 'speciesReferenceGlyph') return;
      var c = placeOf(g, L.by), e = boxEl(g);
      if (k === 'compartmentGlyph') {
        var b = box(g);
        if (!b || !e.d) return;
        d[id] = [nb[0] - b[0], nb[1] - b[1]];   // its labels go with its corner, so a resize to the right or down leaves them
        setXY(e.p, nb[0], nb[1]);
        if (Math.abs(F(av(e.d, 'width')) - nb[2]) >= 1e-6) { T.set(e.d, an(e.d, 'width'), num(nb[2])); moved = true; }
        if (Math.abs(F(av(e.d, 'height')) - nb[3]) >= 1e-6) { T.set(e.d, an(e.d, 'height'), num(nb[3])); moved = true; }
        return;
      }
      var gc = [nb[0] + nb[2] / 2, nb[1] + nb[3] / 2];
      if (!c) return;
      var bb = box(g);
      if (k === 'reactionGlyph' && !curve(g).pts.length && (!bb || !(bb[0] || bb[1] || bb[2] || bb[3]))) {   // no place in the file: read amid its
        // species, so its place is written as a point once that would put it elsewhere (its species moved, or it did)
        var ends = all(g, 'speciesReferenceGlyph').map(function (r) { return G.nodes[av(r, 'speciesGlyph')]; }).filter(Boolean);
        var mid = ends.length ? [ends.reduce(function (a, q) { return a + q[0] + q[2] / 2; }, 0) / ends.length, ends.reduce(function (a, q) { return a + q[1] + q[3] / 2; }, 0) / ends.length] : c;
        d[id] = [gc[0] - c[0], gc[1] - c[1]];
        if (same(mid, gc)) return;
        if (e && e.p) setXY(e.p, gc[0], gc[1]);
        else {   // no box at all: a point given as one, after the glyph's start tag (the Layout package allows a reaction glyph either)
          var pre = g.nodeName.indexOf(':') >= 0 ? g.nodeName.split(':')[0] + ':' : '', ap = (an(g, 'id') || 'id').replace(/id$/, '');
          var heads = kids(g).filter(function (c) { return ln(c) === 'notes' || ln(c) === 'annotation'; }), at = heads.length ? T.end(heads[heads.length - 1]) : T.at.get(g)[1];   // after notes and annotation, as SBML orders them
          T.ed.push([at, at, '<' + pre + 'boundingBox><' + pre + 'position ' + ap + 'x="' + num(gc[0]) + '" ' + ap + 'y="' + num(gc[1]) + '"/><' + pre + 'dimensions ' + ap + 'width="0" ' + ap + 'height="0"/></' + pre + 'boundingBox>']);
          moved = true;
        }
        return;
      }
      var v = [gc[0] - c[0], gc[1] - c[1]];
      if (Math.abs(v[0]) < 1e-6 && Math.abs(v[1]) < 1e-6) { d[id] = [0, 0]; return; }
      d[id] = v;
      if (e && e.p) shift(e.p, v);
      if (k === 'reactionGlyph') shiftCurve(g, v);
    });
    // labels with their glyphs
    all(L.lay, 'textGlyph').forEach(function (tg) {
      var v = d[av(tg, 'graphicalObject')];
      if (!v) return;
      var e = boxEl(tg);
      if (e && e.p) shift(e.p, v);
      shiftCurve(tg, v);
    });
    // lines: their ends with what they join, their bend points as the GraphML has them
    all(L.lay, 'reactionGlyph').forEach(function (rg) {
      var dp = d[av(rg, 'id')] || [0, 0];
      all(rg, 'speciesReferenceGlyph').forEach(function (r) {
        var id = av(r, 'id'), e = id && G.edges[id], sg = L.by[av(r, 'speciesGlyph')], cv = curve(r);
        if (!e || !sg || cv.pts.length < 2) return;
        var ds = d[av(r, 'speciesGlyph')] || [0, 0], sc = placeOf(sg, L.by), first = cv.pts[0], last = cv.pts[cv.pts.length - 1];
        var fromSp = Math.hypot(first[0] - sc[0], first[1] - sc[1]) <= Math.hypot(last[0] - sc[0], last[1] - sc[1]);
        var dA = fromSp ? ds : dp, dB = fromSp ? dp : ds;   // the curve's first point goes with its own glyph, its last with the other
        var spIsSource = e.s === av(r, 'speciesGlyph');
        var bends = fromSp === spIsSource ? e.pts : e.pts.slice().reverse();   // the GraphML's bends in the curve's order
        var inner = cv.pts.slice(1, -1), segs = cv.segs;
        if (bends.length === inner.length) {   // each point's elements: the ends with their glyphs, the bends where the GraphML has them
          var n = cv.els.length;
          cv.els[0].forEach(function (p) { shift(p, dA); });
          cv.els[n - 1].forEach(function (p) { shift(p, dB); });
          shift(kid(segs[0], 'basePoint1'), dA); shift(kid(segs[segs.length - 1], 'basePoint2'), dB);
          inner.forEach(function (p, k) {
            if (same(bends[k], p)) return;
            var v = [bends[k][0] - p[0], bends[k][1] - p[1]];
            cv.els[k + 1].forEach(function (e) {   // the bend, and the control point beside it in each segment it ends or starts
              setXY(e, bends[k][0], bends[k][1]);
              shift(kid(e.parentNode, ln(e) === 'end' ? 'basePoint2' : 'basePoint1'), v);
            });
          });
          return;
        }
        // another number of bend points: straight segments through them
        var a = [first[0] + dA[0], first[1] + dA[1]], z = [last[0] + dB[0], last[1] + dB[1]], line = [a].concat(bends, [z]);
        var tag = segs[0].nodeName, pre = tag.indexOf(':') >= 0 ? tag.split(':')[0] + ':' : '', ap = (an(kid(segs[0], 'start'), 'x') || 'x').replace(/x$/, '');
        var xsi = an(segs[0], 'type') || 'xsi:type', ind = T.indent(segs[0]), body = '';
        if (!an(segs[0], 'type')) xsi = 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type';   // the file's segments name no type: its prefix declared on each
        for (var s = 0; s + 1 < line.length; s++)
          body += '\n' + ind + '<' + tag + ' ' + xsi + '="LineSegment"><' + pre + 'start ' + ap + 'x="' + num(line[s][0]) + '" ' + ap + 'y="' + num(line[s][1]) + '"/><' + pre + 'end ' + ap + 'x="' + num(line[s + 1][0]) + '" ' + ap + 'y="' + num(line[s + 1][1]) + '"/></' + tag + '>';
        segs.forEach(function (sg) { kids(sg).forEach(function (p) { put.delete(p); }); });
        var from = T.at.get(segs[0])[0], to = T.end(segs[segs.length - 1]);
        T.ed.push([from, to, body.replace(/^\n\s*/, '')]);
        moved = true;
      });
    });
    put.forEach(function (v, e) {
      if (Math.abs(F(av(e, 'x')) - v[0]) >= 1e-6) { T.set(e, an(e, 'x'), num(v[0])); moved = true; }
      if (Math.abs(F(av(e, 'y')) - v[1]) >= 1e-6) { T.set(e, an(e, 'y'), num(v[1])); moved = true; }
    });
    return moved ? T.text() : t;
  }
  function isAf(t) { return /<(\w+:)?listOfQualitativeSpecies[\s>]/.test(t || ''); }
  function mapKind(t) { return isAf(t) ? 'af' : 'pd'; }
  function nameable() { return false; }   // layout only: no name is written

  var api = { graphml: graphml, write: write, isAf: isAf, mapKind: mapKind, nameable: nameable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.sbml_edit = api;
})(typeof self !== 'undefined' ? self : this);
