    // ---------- the CellDesigner part (editor/src/celldesigner.js) ----------
    // A CellDesigner map edited in CellDesigner's own model: the GraphML renderers/converter/cd_edit.js makes of it, the
    // moves written back into the CellDesigner text by it, the map drawn by cdrender.js (both in JavaScript since
    // 2026-11-13, the same text as their Python masters byte for byte, tests/cd-compare.js: no Python in the editor);
    // the process glyph that follows its segment, the guides through it, the canvas left out while editing.

    // a CellDesigner map (2026-11-12, user: "basically yEd experience with CD"): edited as the GraphML that
    // renderers/converter/cd_edit.js makes of it (cd_edit.py's header says how), the moves written back into the CellDesigner file
    // by it and the map drawn by cdrender, each part in a group of its own; text is that GraphML, cd.now the file
    var cdp = null, cdJs = null, cd = null;   // the CellDesigner side loading, once loaded, the file edited ({ base, now })
    function isCd(t) { return /<sbml[\s>]/.test(t.slice(0, 3000)) && t.indexOf('celldesigner') >= 0; }
    // a process glyph not moved itself stays midway on its segment of the main line wherever that goes (cd_edit), so
    // while a drag or the keys move a segment's end it follows at once (user, 2026-11-12: it jumped there only on
    // release): procs, each glyph with its two main arcs; liveG, the glyphs' shifts until the map is drawn again
    var procs = [], liveG = null;
    function cdpy() {   // the CellDesigner side: cdrender.js, then cd_edit.js (it reads cdrender), quick to load
      if (cdp) return cdp;
      var script = function (f) {
        return new Promise(function (res, rej) {
          var s = document.createElement('script');
          s.src = '/renderers/converter/' + f + '.js' + V.build; s.onload = res; s.onerror = function () { rej(f + ' not found'); };
          document.head.appendChild(s);
        });
      };
      cdp = (window.cdrender ? Promise.resolve() : script('cdrender')).then(function () { return window.cd_edit ? null : script('cd_edit'); })
        .then(function () { cdJs = window.cd_edit; return cdJs; });
      cdp.catch(function (e) { cdp = null; warn('The CellDesigner renderer did not load: ' + e); });
      return cdp;
    }
    // a CellDesigner file made into the editor's GraphML once per text (read ahead while the map is shown, then at the
    // switch and for the click data the same text again): the last few kept
    var cdMemo = [];
    function cdGraphml(t) {
      var g = cdKnown(t);
      if (g) return g;
      g = cdJs.graphml(t);
      cdRemember(t, g);
      return g;
    }
    function cdKnown(t) { for (var i = 0; i < cdMemo.length; i++) if (cdMemo[i][0] === t) return cdMemo[i][1]; return null; }   // without adding to the memo
    function cdRemember(t, g) { cdMemo.unshift([t, g]); cdMemo.length = Math.min(cdMemo.length, 3); }   // also the editor's own text on leaving (keepAhead)
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
    // since cdLines draws a move with the drop's own code, glyphFollow's drawing is the fallback only; its glyph place
    // (liveG, corrected by cdLines) and the hiding of the lines still serve the guides and the selection
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
    // a move drawn live by the drop's own code (2026-11-13, user: during a drag, a held arrow key or a dragged anchor
    // point the reaction came apart and was right only after the drop): cd_edit.live, made once from the drawing on
    // screen (cdBase, set where the drawing is put in; made ahead when the browser is idle), writes the reactions the
    // move touches as the drop writes them and draws them with cdrender's own reaction drawing (the same text as the
    // drawing after the drop, tests/cd-live.js), put in place of their groups as copies; the glyph's place follows it
    var cdBase = null, cdLive = null;
    function cdSession() {
      if (!cd || !cdJs || !cdJs.live || !cdBase) return null;
      if (cdLive && cdLive.base === cdBase) return cdLive.s;
      try { cdLive = { base: cdBase, s: cdJs.live(cdBase.now, cdBase.text) }; } catch (e) { cdLive = null; }
      return cdLive ? cdLive.s : null;
    }
    function cdSessionSoon() { (window.requestIdleCallback || function (f) { setTimeout(f, 0); })(function () { if (on) cdSession(); }); }
    var RXE = /^(.*)\|(a|b|[rpm]\d+)$/;
    function cdLines(ks, pp) {   // false: not drawn this way (the copies of fullLines then)
      if (!cd || !gE) return false;
      var rids = new Set();
      ks.forEach(function (k) { var m = edges2[k].id.match(RXE); if (m) rids.add(m[1]); });
      if (!rids.size) return false;
      var S = cdSession();
      if (!S) return false;
      var bends = new Map(), paths = new Map(), boxes = new Map(), byE = {};
      edges2.forEach(function (e, k) {
        byE[e.id] = k;
        var m = e.id.match(RXE);
        if (!m || !rids.has(m[1])) return;
        bends.set(e.id, e.pts.map(function (pi) { return pt(pi); }));
        if (!e.path) return;
        var q = ['sx', 'sy', 'tx', 'ty'].map(function (a) { return parseFloat(e.path.getAttribute(a)) || 0; });
        if (pp && pp.to && pp.k === k) { var j = pp.end ? 2 : 0; q[j] = pp.to[0]; q[j + 1] = pp.to[1]; }
        paths.set(e.id, q);
      });
      // the boxes of every node of those reactions as they are now (also when the drawing on screen is older than the
      // file, a redraw under way)
      edges2.forEach(function (e) {
        var m = e.id.match(RXE);
        if (!m || !rids.has(m[1])) return;
        [e.s, e.t].forEach(function (i) { if (i != null && !/\|proc$/.test(nodes2[i].id)) boxes.set(nodes2[i].id, bx(i)); });
      });
      var list = Array.from(rids), out = S.frame(boxes, bends, paths, list);
      if (list.some(function (r) { return !out[r]; })) return false;
      dropCopies();
      list.forEach(function (rid) {
        var f = out[rid], ids = Object.keys(gE).filter(function (id) { return id.indexOf(rid + '|') === 0; });
        if (!ids.length) return;
        var ref = gE[ids[0]], hRef = ref[0], lRef = ref[ref.length - 1], pg = gN[rid + '|proc'];
        ids.forEach(function (id) { gE[id].forEach(function (g) { g.style.display = 'none'; }); });
        if (pg) pg.style.display = 'none';
        var doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><g>' + f.halo + '</g><g>' + f.lines + '</g></svg>', 'image/svg+xml').documentElement;
        var parts = Array.prototype.filter.call(doc.childNodes, function (c) { return c.nodeType === 1; });
        [[parts[0], hRef, 0], [parts[1], lRef, 1]].forEach(function (q) {
          Array.prototype.filter.call(q[0].childNodes, function (c) { return c.nodeType === 1; }).forEach(function (c) {
            var el = document.importNode(c, true), id = el.getAttribute('data-e'), pn = el.getAttribute('data-n');
            var orig = id && gE[id] ? gE[id][q[2] ? gE[id].length - 1 : 0] : pn ? gN[pn] : null;
            el.removeAttribute('data-e'); el.removeAttribute('data-n'); el.classList.add('m2-ed-copy');
            q[1].parentNode.insertBefore(el, q[1]);
            copies.push([el, orig, id && byE[id] != null ? byE[id] : null]);
          });
        });
        // the glyph where it is drawn now (selection, guides, the ends of the lines at it)
        var gi = nodes2.findIndex(function (n) { return n.id === rid + '|proc'; }), r0 = S.rest(rid);
        if (gi >= 0 && r0 && f.sq) {
          liveG = liveG || {};
          liveG[gi] = [f.sq[0] - r0[0][0], f.sq[1] - r0[0][1], f.ang - r0[1], r0[2] ? f.len / r0[2] : 1, [r0[0][0], r0[0][1], r0[1], r0[2]]];
        }
      });
      return true;
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
    // the CellDesigner side loaded in the background a few seconds after the page has shown a CellDesigner map where the
    // Edit tab is (user, 2026-11-12: a map took about 4 s to open for editing while Python loaded; since 2026-11-13 two
    // small JavaScript files, no Python)
    function cdMap(m) { var d = m && m.downloads && m.downloads[0]; return !!(d && d.label === 'CellDesigner'); }
    var warm = null;
    function warmUp() {
      clearTimeout(warm);
      warm = setTimeout(function () {
        var eb = document.querySelector('#m2-rail .m2-ri[data-win="edit"]');
        if (cdp || !eb || !eb.offsetParent || !cdMap(V.current)) return;
        (window.requestIdleCallback || function (f) { setTimeout(f, 0); })(function () {
          if (cdp || !cdMap(V.current)) return;
          var s0 = status.textContent, w0 = status.classList.contains('m2-ed-warn');   // quietly, a warning kept as it was
          var back = function () { if (!on) { status.textContent = s0; status.classList.toggle('m2-ed-warn', w0); } };
          cdpy().then(back, function () {});
          back();
        });
      }, 2500);
    }
    warmUp();
