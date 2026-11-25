import { shared } from './state.js';
import { boxOf, cut, edges2, ports, pt } from './core.js';
import { bx, restPt } from './live.js';

    // ---------- where lines meet glyphs (editor/src/geometry.js) ----------
    // How a line meets a process glyph that stays midway on its segment of the reaction's main line, for the live drawing,
    // the guides and a bend point lined up through the glyph; and whether a line's end on a node takes its centre. Called
    // from shared code on every map: the process glyphs are graphml_edit's reading of the map (shared.procs, nodes <id>|proc
    // with lines |a and |b), which only cd_edit's GraphML of a CellDesigner map has today, so on other maps the list is
    // empty and these do nothing; shared.liveG is set by celldesigner.js. A format with such glyphs of its own uses the same
    // code by writing them the same way.

    function nodeCentre(n, P) {   // whether an end at P on a node takes its centre: P in the middle half of its box
      var b = bx(n);
      return Math.max(Math.abs(P[0] - b[0] - b[2] / 2) / (b[2] / 2 || 1), Math.abs(P[1] - b[1] - b[3] / 2) / (b[3] / 2 || 1)) < 0.5;
    }
    function glyphMid(q, B, P, pp) {   // where cd_edit puts the glyph: midway on its segment, an end at a node cut at its box
      var ea = edges2[q.a], eb = edges2[q.b], o = function (e, a) {
        if (pp && pp.to && edges2[pp.k] === e && (pp.end ? 't' : 's') === a[0]) return pp.to[a[1] === 'x' ? 0 : 1];
        return e.path ? parseFloat(e.path.getAttribute(a)) || 0 : 0;
      };
      var S = B(pp && pp.n2 != null && edges2[pp.k] === ea && !pp.end ? pp.n2 : ea.s), T = B(pp && pp.n2 != null && edges2[pp.k] === eb && pp.end ? pp.n2 : eb.t);   // an end over another node at that node
      var all = [[S[0] + S[2] / 2 + o(ea, 'sx'), S[1] + S[3] / 2 + o(ea, 'sy')]].concat(ea.pts.map(P), eb.pts.map(P),
        [[T[0] + T[2] / 2 + o(eb, 'tx'), T[1] + T[3] / 2 + o(eb, 'ty')]]);
      var k = ea.pts.length, n = all.length - 1, a = all[k], b = all[k + 1];
      if (k === 0) a = cut(all[0], all[1], S);
      if (k + 1 === n) b = cut(all[n], all[n - 1], T);
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(b[1] - a[1], b[0] - a[0]), Math.hypot(b[0] - a[0], b[1] - a[1])];
    }
    // where a line meets a glyph that follows its segment: CellDesigner ties the meeting points to the segment, an added
    // reactant or product at a share of it (turned and stretched with it), a modifier at a spot round the glyph (turned)
    function glyphPort(i, off, eid) {
      var L = shared.liveG && shared.liveG[i];
      if (!L || (!L[2] && L[3] === 1)) return off;
      var c = Math.cos(L[2]), s2 = Math.sin(L[2]), f = /\|[rp]\d+$/.test(eid) ? L[3] : 1;
      return [f * (c * off[0] - s2 * off[1]), f * (s2 * off[0] + c * off[1])];
    }
    // the neighbour of point i of arc k (all: ports(k)) for guides: a CellDesigner reaction is one line through its glyph,
    // from port or bend point to the next port or bend point past the process,
    // so an end at the glyph gives way to the next point past it, the glyph sitting midway between;
    // returns [the point, its bend point index or null]
    function beyond(k, i, all) {
      var e = edges2[k], last = all.length - 1;
      if (i > 0 && i < last) return [all[i], e.pts[i - 1]];
      var q = shared.procs.find(function (r) { return (i === last && r.a === k) || (i === 0 && r.b === k); });
      if (!q) return [all[i], null];
      if (i === last) { var eb = edges2[q.b]; if (eb.t == null) return [all[i], null]; return eb.pts.length ? [pt(eb.pts[0]), eb.pts[0]] : [ports(q.b)[eb.pts.length + 1], null]; }
      var ea = edges2[q.a]; if (ea.s == null) return [all[i], null];
      return ea.pts.length ? [pt(ea.pts[ea.pts.length - 1]), ea.pts[ea.pts.length - 1]] : [ports(q.a)[0], null];
    }
    // lines meeting a CellDesigner glyph that follows the segment a bend point moves (so that, for example, an added product
    // turning level while its reaction's bend point moves gets its guide): each such line, where it meets the glyph
    // for the bend at B (as glyphFollow and glyphPort place it), and the point its first segment runs to
    function glyphArcs(bp) {
      var out = [];
      shared.procs.forEach(function (q) {
        var ea = edges2[q.a], eb = edges2[q.b];
        if (ea.s == null || eb.t == null || (ea.pts.indexOf(bp) < 0 && eb.pts.indexOf(bp) < 0)) return;
        edges2.forEach(function (e, k) { if (k !== q.a && k !== q.b && e.s != null && e.t != null && (e.s === q.g || e.t === q.g)) out.push({ q: q, k: k }); });
      });
      return out;
    }
    function joinAt(o, bp, B) {
      var q = o.q, e = edges2[o.k], st = e.s === q.g, P2 = function (pi) { return pi === bp ? B : pt(pi); };
      var at = function (a) { return e.path ? parseFloat(e.path.getAttribute(a)) || 0 : 0; };
      var r = glyphMid(q, boxOf, restPt), m = glyphMid(q, bx, P2), off = st ? [at('sx'), at('sy')] : [at('tx'), at('ty')];
      var f = /\|[rp]\d+$/.test(e.id) && r[3] ? m[3] / r[3] : 1, t = m[2] - r[2], c = Math.cos(t), s2 = Math.sin(t), G = boxOf(q.g);
      var J = [G[0] + G[2] / 2 + m[0] - r[0] + f * (c * off[0] - s2 * off[1]), G[1] + G[3] / 2 + m[1] - r[1] + f * (s2 * off[0] + c * off[1])];
      var N;
      if (st) { if (e.pts.length) N = pt(e.pts[0]); else { var T = bx(e.t); N = [T[0] + T[2] / 2 + at('tx'), T[1] + T[3] / 2 + at('ty')]; } }
      else { if (e.pts.length) N = pt(e.pts[e.pts.length - 1]); else { var S = bx(e.s); N = [S[0] + S[2] / 2 + at('sx'), S[1] + S[3] / 2 + at('sy')]; } }
      return [J, N];
    }
    // how far the bend moves along axis ax so that the line turns upright (cm 0) or level (cm 1); null if it hardly moves it
    function joinSolve(o, bp, B, ax, cm) {
      var c = 0;
      for (var it = 0; it < 4; it++) {
        var P0 = B.slice(), P1 = B.slice(); P0[ax] += c; P1[ax] += c + 1;
        var a = joinAt(o, bp, P0), b = joinAt(o, bp, P1), res = a[0][cm] - a[1][cm], dv = (b[0][cm] - b[1][cm]) - res;
        if (Math.abs(dv) < 0.05) return null;
        c -= res / dv;
        if (Math.abs(res) < 1e-4) break;
      }
      return c;
    }
    function joinGuides(bp, B) {
      var out = [];
      glyphArcs(bp).forEach(function (o) { var J = joinAt(o, bp, B); if (Math.abs(J[0][0] - J[1][0]) < 0.05 || Math.abs(J[0][1] - J[1][1]) < 0.05) out.push(J); });
      return out;
    }
    export { beyond, glyphArcs, glyphMid, glyphPort, joinAt, joinGuides, joinSolve, nodeCentre };
