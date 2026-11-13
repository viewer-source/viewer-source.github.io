    // ---------- the CellDesigner part (editor/src/celldesigner.js) ----------
    // A CellDesigner map edited in CellDesigner's own model: the GraphML renderers/converter/cd_edit.py makes of it, the
    // moves written back into the CellDesigner text by it, the map drawn by cdrender (Pyodide, lxml and the converter);
    // the process glyph that follows its segment, the guides through it, the canvas left out while editing.

    // a CellDesigner map (2026-11-12, user: "basically yEd experience with CD"): edited as the GraphML that
    // renderers/converter/cd_edit.py makes of it (its header says how), the moves written back into the CellDesigner file
    // by it and the map drawn by cdrender, each part in a group of its own; text is that GraphML, cd.now the file
    var PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';   // as the converter's page
    var py = null;                 // a promise of Python with lxml (Pyodide): only for the CellDesigner side
    function python() {
      if (py) return py;
      say('Loading Python (a few seconds the first time)...');
      py = new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = PYODIDE + 'pyodide.js'; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      }).then(function () { return loadPyodide({ indexURL: PYODIDE }); }).then(function (p) {
        return p.loadPackage('lxml').then(function () { p.FS.mkdirTree('/home/pyodide'); p.runPython("import sys, json\nsys.path.insert(0, '/home/pyodide')"); return p; });
      });
      py.catch(function (e) { py = null; say('Python did not load: ' + e); });
      return py;
    }
    var cdp = null, pyCd = null, cd = null;   // Python with the CellDesigner side, that Python once ready, the file edited ({ base, now })
    var CD_FILES = ['cdrender', 'cd_edit'], MAPCONV = ['annotation', 'cd_layout', 'cd_tidy', 'celldesigner', 'graphml', 'layout', 'model', 'report', 'style'];
    var CD_DRIVER = ['import cd_edit', 'def cd_graphml(t):', '    return cd_edit.graphml(t)', 'def cd_draw(t, g):', '    return json.dumps(cd_edit.draw(t, g))'].join('\n');
    function isCd(t) { return /<sbml[\s>]/.test(t.slice(0, 3000)) && t.indexOf('celldesigner') >= 0; }
    // a process glyph not moved itself stays midway on its segment of the main line wherever that goes (cd_edit), so
    // while a drag or the keys move a segment's end it follows at once (user, 2026-11-12: it jumped there only on
    // release): procs, each glyph with its two main arcs; liveG, the glyphs' shifts until the map is drawn again
    var procs = [], liveG = null;
    function cdpy() {   // the CellDesigner side: cdrender, cd_edit and the converter's modules they import
      if (cdp) return cdp;
      cdp = python().then(function (p) {
        var get = function (u, to) { return fetch(u).then(function (r) { if (!r.ok) throw u + ' not found'; return r.text(); }).then(function (t) { p.FS.writeFile(to, t); }); };
        p.FS.mkdirTree('/home/pyodide/mapconv');
        return Promise.all(CD_FILES.map(function (f) { return get('/renderers/converter/' + f + '.py', '/home/pyodide/' + f + '.py'); })
          .concat(MAPCONV.map(function (f) { return get('/renderers/converter/mapconv/' + f + '.py', '/home/pyodide/mapconv/' + f + '.py'); })))
          .then(function () { p.runPython(CD_DRIVER); pyCd = p; return p; });
      });
      cdp.catch(function (e) { cdp = null; say('The CellDesigner renderer did not load: ' + e); });
      return cdp;
    }
    function glyphMid(q, B, P, pp) {   // where cd_edit puts the glyph: midway on its segment, an end at a node cut at its box
      var ea = edges2[q.a], eb = edges2[q.b], o = function (e, a) {
        if (pp && pp.to && edges2[pp.k] === e && (pp.end ? 't' : 's') === a[0]) return pp.to[a[1] === 'x' ? 0 : 1];
        return e.path ? parseFloat(e.path.getAttribute(a)) || 0 : 0;
      };
      var S = B(ea.s), T = B(eb.t);
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
      var L = liveG && liveG[i];
      if (!L || (!L[2] && L[3] === 1)) return off;
      var c = Math.cos(L[2]), s2 = Math.sin(L[2]), f = /\|[rp]\d+$/.test(eid) ? L[3] : 1;
      return [f * (c * off[0] - s2 * off[1]), f * (s2 * off[0] + c * off[1])];
    }
    // the glyphs whose segment moves: shifted by how far their middle moved (the same reckoning before and now, so a
    // glyph does not jump at the start), their lines drawn live. ns, ps: the nodes and bend points moving; back: how far
    // the keys moved them already in the file (null in a drag, where the file has them still where they were)
    function glyphFollow(ns, ps, back, pp) {   // pp: a port being dragged
      if (!procs.length || !gN) return;
      var old = liveG; liveG = null;
      var rest = function (i) { var b = boxOf(i); return back && ns.has(i) ? [b[0] - back[0], b[1] - back[1], b[2], b[3]] : b; };
      var restP = function (pi) { var p = points[pi], o = back && ps.has(pi); return [num(p, 'x') - (o ? back[0] : 0), num(p, 'y') - (o ? back[1] : 0)]; };
      var out = {}, any = false;
      procs.forEach(function (q) {
        var ea = edges2[q.a], eb = edges2[q.b];
        if (ns.has(q.g) || ea.s == null || eb.t == null) return;
        var port = pp && pp.to && (pp.k === q.a || pp.k === q.b);
        if (!(port || ns.has(ea.s) || ns.has(eb.t) || ea.pts.concat(eb.pts).some(function (p) { return ps.has(p); }))) return;
        var a = glyphMid(q, bx, pt, pp), b = glyphMid(q, rest, restP);
        out[q.g] = [a[0] - b[0], a[1] - b[1], isFinite(a[2] - b[2]) && b[3] ? a[2] - b[2] : 0, b[3] ? a[3] / b[3] : 1, b]; any = true;
      });
      if (old) Object.keys(old).forEach(function (i) { if (!out[i]) { var g = gN[nodes2[i].id]; if (g) g.removeAttribute('transform'); } });
      if (!any) return;
      liveG = out; live = live || new Set();
      Object.keys(out).forEach(function (i) {
        var o2 = out[i], c0 = o2[4], g = gN[nodes2[i].id];   // moved with its middle and turned with its segment
        if (g) g.setAttribute('transform', 'translate(' + f1(c0[0] + o2[0]) + ' ' + f1(c0[1] + o2[1]) + ') rotate(' + f1(o2[2] * 180 / Math.PI) + ') translate(' + f1(-c0[0]) + ' ' + f1(-c0[1]) + ')');
        edges2.forEach(function (e, k) {
          if (e.s !== +i && e.t !== +i) return;
          var gs = gE[e.id]; if (gs) gs.forEach(function (x) { x.style.display = 'none'; });
          live.add(k);
        });
      });
    }
    // the neighbour of point i of arc k (all: ports(k)) for guides: a CellDesigner reaction is one line through its glyph
    // (user, 2026-11-13: "in cell designer concept, it's a single line ... through process and higher until the port or
    // another bend point"), so an end at the glyph gives way to the next point past it, the glyph sitting midway between;
    // returns [the point, its bend point index or null]
    function beyond(k, i, all) {
      var e = edges2[k], last = all.length - 1;
      if (i > 0 && i < last) return [all[i], e.pts[i - 1]];
      var q = procs.find(function (r) { return (i === last && r.a === k) || (i === 0 && r.b === k); });
      if (!q) return [all[i], null];
      if (i === last) { var eb = edges2[q.b]; if (eb.t == null) return [all[i], null]; return eb.pts.length ? [pt(eb.pts[0]), eb.pts[0]] : [ports(q.b)[eb.pts.length + 1], null]; }
      var ea = edges2[q.a]; if (ea.s == null) return [all[i], null];
      return ea.pts.length ? [pt(ea.pts[ea.pts.length - 1]), ea.pts[ea.pts.length - 1]] : [ports(q.a)[0], null];
    }
    // lines meeting a CellDesigner glyph that follows the segment a bend point moves (user, 2026-11-13: an added product
    // turning level while its reaction's anchor point moved showed no guide): each such line, where it meets the glyph
    // for the bend at B (as glyphFollow and glyphPort place it), and the point its first segment runs to
    function glyphArcs(bp) {
      var out = [];
      procs.forEach(function (q) {
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
    // a CellDesigner drawing's white canvas left out while editing (user, 2026-11-12: "like an endless space", as a
    // GraphML map; white hides the grid): the site's picture shown at the start is the same picture without it (an
    // editor's drawing is in the page, where a rule of the viewer hides it)
    function plainCanvas() {
      var el = V.img;
      if (!el || el.tagName !== 'IMG' || !el.src) return;
      fetch(el.src).then(function (r) { return r.text(); }).then(function (t) {
        var u = t.replace(/<rect width="100%" height="100%" fill="#fff"\/>\n?/, '');
        if (u === t || !on || V.img !== el) return;
        var url = URL.createObjectURL(new Blob([u], { type: 'image/svg+xml' })), i = new Image();
        i.onload = function () {   // decoded first, so the picture never flickers
          if (!on || V.img !== el) { URL.revokeObjectURL(url); return; }
          var old = el.src; el.src = url;
          if (old.indexOf('blob:') === 0) setTimeout(function () { URL.revokeObjectURL(old); }, 1000);
        };
        i.src = url;
      }).catch(function () {});
    }
    // Python started in the background (user, 2026-11-12: a CellDesigner map took about 4 s to open for editing, Python and
    // the converter loading first): a few seconds after the page has shown a CellDesigner map where the Edit tab is, when
    // the browser is idle. Since 2026-11-13 only for a CellDesigner map (a GraphML map needs no Python: its renderer and
    // the layout tools are JavaScript), so a page on a GraphML map never freezes for Python's start
    function cdMap(m) { var d = m && m.downloads && m.downloads[0]; return !!(d && d.label === 'CellDesigner'); }
    var warm = null;
    function warmUp() {
      clearTimeout(warm);
      warm = setTimeout(function () {
        var eb = document.querySelector('#m2-rail .m2-ri[data-win="edit"]');
        if (cdp || !eb || !eb.offsetParent || !cdMap(V.current)) return;
        (window.requestIdleCallback || function (f) { setTimeout(f, 0); })(function () {
          if (cdp || !cdMap(V.current)) return;
          var s0 = status.textContent;   // quietly: its "Loading" message not shown
          cdpy().then(function () { if (!on) status.textContent = s0; }, function () {});
          if (!on) status.textContent = s0;
        });
      }, 2500);
    }
    warmUp();
