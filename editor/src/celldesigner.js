import { shared, V } from './state.js';
import { boxOf, cut, edges2, f1, gE, gN, gridBlock, lastFor, lastSvg, nodes2, num, on, points, ports, pt, rebase, spotNo, status, undo, warn } from './core.js';
import { bx, dropCopies, picOff, restPt, toPic } from './live.js';
import { cdCheck, cdClsOf, cdRole } from './cdcreate.js';

    // ---------- the CellDesigner part (editor/src/celldesigner.js) ----------
    // A CellDesigner map edited in CellDesigner's own model: the GraphML renderers/converter/cd_edit.js makes of it, the
    // moves written back into the CellDesigner text by it, the map drawn by cdrender.js (both in JavaScript, their output
    // compared with the previous release's, tests/cd-compare.js: no Python in the editor);
    // the process glyph that follows its segment, the guides through it, the canvas left out while editing.

    // a CellDesigner map, edited with the same tools as a yEd map: as the GraphML that
    // renderers/converter/cd_edit.js makes of it (cd_edit-rules.md's header says how), the moves written back into the CellDesigner file
    // by it and the map drawn by cdrender, each part in a group of its own; text is that GraphML, cd.now the file
    var cdp, cdJs, cdMk;
    function __run1() {   // run at start, in order (__start)
    cdp = null, cdJs = null, cdMk = null, shared.cd = null;
    }   // the CellDesigner side loading, once loaded (cd_edit, cd_make), the file edited ({ base, now })
    function isCd(t) { return /<sbml[\s>]/.test(t.slice(0, 3000)) && t.indexOf('celldesigner') >= 0; }
    // the line grid (core.js, lineStep): a line's end on a node on it inside the shape and along its outline, bend points
    // snapping to it; or none: a line's end at one of the node's places only, as a CellDesigner file keeps a species' line,
    // places that follow each node's size and so meet no grid, its bend points lined up by the guides alone
    function lineGrid() { return !shared.cd; }
    // the places a line's end takes on node n where the format fixes them, as offsets from its centre with the place's
    // name third: on a CellDesigner species its 16 (cdrender anchorAt, on a multimer's front copy as the line is drawn),
    // which cd_edit writes as that place; the centre apart (nodeCentre). A dragged end (core.js spot) and a new line
    // (cdcreate.js cdPort) land alike. null elsewhere
    function nodePlaces(n) {
      var R = window.cdrender, cl = shared.cd && R && R.anchorAt && cdRole(n) === 'epn' ? cdClsOf(nodes2[n].id) : null;
      if (!cl) return null;
      var b = bx(n), C = [b[0] + b[2] / 2, b[1] + b[3] / 2], f = R.frontBox(b, cl[1]);
      return Object.keys(R.ANCHOR).map(function (k) { var A = R.anchorAt(cl[0], f, k); return [A[0] - C[0], A[1] - C[1], k]; });
    }
    function nodeCentre(n, P) {   // whether an end at P on such a node takes its centre: P in the middle half of its box
      var b = bx(n);
      return Math.max(Math.abs(P[0] - b[0] - b[2] / 2) / (b[2] / 2 || 1), Math.abs(P[1] - b[1] - b[3] / 2) / (b[3] / 2 || 1)) < 0.5;
    }
    // a process glyph not moved itself stays midway on its segment of the main line wherever that goes (cd_edit), so
    // while a drag or the keys move a segment's end it follows at once (not only on
    // release): procs, each glyph with its two main arcs; liveG, the glyphs' shifts until the map is drawn again
    function __run2() {   // run at start, in order (__start)
    shared.procs = [], shared.liveG = null;
    }
    function cdpy() {   // the CellDesigner side: cdrender.js, then cd_edit.js (it reads cdrender), quick to load
      if (cdp) return cdp;
      var script = function (f) {
        return new Promise(function (res, rej) {
          var s = document.createElement('script');
          s.src = V.renderers + 'converter/' + f + '.js' + V.build; s.onload = res; s.onerror = function () { rej(f + ' not found'); };
          document.head.appendChild(s);
        });
      };
      // cd_make, the writer of what the palette makes (cdcreate.js), last: it reads both. Not loaded, the maps are drawn and
      // moved as before and only the palette stays away (cdPal)
      cdp = (window.cdrender ? Promise.resolve() : script('cdrender')).then(function () { return window.cd_edit ? null : script('cd_edit'); })
        .then(function () { return window.cd_make ? null : script('cd_make').catch(function () {}); })
        .then(function () { cdJs = window.cd_edit; cdMk = window.cd_make || null; if (cdMk) cdCheck(); return cdJs; });
      cdp.catch(function (e) { cdp = null; warn('The CellDesigner renderer did not load: ' + e); });
      return cdp;
    }
    // a CellDesigner file made into the editor's GraphML once per text (read ahead while the map is shown, then at the
    // switch and for the click data the same text again): the last few kept
    var cdMemo;
    function __run3() {   // run at start, in order (__start)
    cdMemo = [];
    }
    // once the map has changed (an undo step taken), every drawing fits the canvas round the content (cd_edit.place's fit:
    // the content's top left 40 to 40 + the block (gridBlock) from the corner, the canvas MARGIN past its right and bottom), so the file saved, its
    // downloads and the site's picture never carry a canvas larger than the map; the shift moves the frame with it
    // (render, cdRebuild). Unchanged, the file draws as itself: opening it, or every change undone, saves nothing and
    // leaves the picture's frame as the site's. fit given: the read-ahead, before editing
    function cdDraw(t, g, fit) { return cdJs.draw(t, g, { fit: fit == null ? undo.length > 0 : fit, block: gridBlock() }); }
    // the file as drawn now (a move not drawn yet put in) with the shift (out of negative places, or the fit) that drawing holds: the
    // drawing on screen when it is of this GraphML, else drawn here (x0 may still belong to an older drawing)
    function cdShift(svg) { var m = /<g transform="translate\(([-\d.]+),([-\d.]+)\)">/.exec(svg || ''); return m ? [+m[1], +m[2]] : [0, 0]; }
    function cdNow() {
      if (lastFor && lastFor[0] === shared.text && lastFor[1] === shared.cd.now) return { t: shared.cd.now, sh: cdShift(lastSvg) };
      var q = cdDraw(shared.cd.base, shared.text);
      return { t: q[1], sh: cdShift(q[0]) };
    }
    // a changed file made the map's base, its GraphML made again (the caller parses it): that GraphML is in the drawn file's
    // places, so the editor's places move by the drawing's shift, and the frame with them (rebase): nothing moves on screen
    function cdRebuild(t, sh) { shared.cd.base = t; shared.text = cdGraphml(t); rebase(sh[0], sh[1]); }
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
    // the glyphs whose segment moves: shifted by how far their middle moved (the same reckoning before and now, so a
    // glyph does not jump at the start), their lines drawn live. ns, ps: the nodes and bend points moving; back: how far
    // the keys moved them already in the file (null in a drag, where the file has them still where they were)
    // since cdLines draws a move with the drop's own code, glyphFollow's drawing is the fallback only; its glyph place
    // (liveG, corrected by cdLines) and the hiding of the lines still serve the guides and the selection
    function glyphFollow(ns, ps, back, pp) {   // pp: a port being dragged
      if (!shared.procs.length || !gN) return;
      var old = shared.liveG; shared.liveG = null;
      var rest = function (i) { var b = boxOf(i); return back && ns.has(i) ? [b[0] - back[0], b[1] - back[1], b[2], b[3]] : b; };
      var restP = function (pi) { var p = points[pi], o = back && ps.has(pi); return [num(p, 'x') - (o ? back[0] : 0), num(p, 'y') - (o ? back[1] : 0)]; };
      var out = {}, any = false;
      shared.procs.forEach(function (q) {
        var ea = edges2[q.a], eb = edges2[q.b];
        if (ns.has(q.g) || ea.s == null || eb.t == null) return;
        var port = pp && pp.to && (pp.k === q.a || pp.k === q.b);
        if (!(port || ns.has(ea.s) || ns.has(eb.t) || ea.pts.concat(eb.pts).some(function (p) { return ps.has(p); }))) return;
        var a = glyphMid(q, bx, pt, pp), b = glyphMid(q, rest, restP);
        out[q.g] = [a[0] - b[0], a[1] - b[1], isFinite(a[2] - b[2]) && b[3] ? a[2] - b[2] : 0, b[3] ? a[3] / b[3] : 1, b]; any = true;
      });
      if (old) Object.keys(old).forEach(function (i) { if (!out[i]) { var g = gN[nodes2[i].id]; if (g) g.removeAttribute('transform'); } });
      if (!any) return;
      shared.liveG = out; shared.live = shared.live || new Set();
      Object.keys(out).forEach(function (i) {
        var o2 = out[i], c0 = toPic(o2[4]), g = gN[nodes2[i].id];   // moved with its middle and turned with its segment (about its middle on the picture)
        if (g) g.setAttribute('transform', 'translate(' + f1(c0[0] + o2[0]) + ' ' + f1(c0[1] + o2[1]) + ') rotate(' + f1(o2[2] * 180 / Math.PI) + ') translate(' + f1(-c0[0]) + ' ' + f1(-c0[1]) + ')');
        edges2.forEach(function (e, k) {
          if (e.s !== +i && e.t !== +i) return;
          var gs = gE[e.id]; if (gs) gs.forEach(function (x) { x.style.display = 'none'; });
          shared.live.add(k);
        });
      });
    }
    // a move drawn live by the drop's own code (otherwise, during a drag, a held arrow key or a dragged anchor
    // point, the reaction comes apart until the drop): cd_edit.live, made once from the drawing on
    // screen (cdBase, set where the drawing is put in; made ahead when the browser is idle), writes the reactions the
    // move touches as the drop writes them and draws them with cdrender's own reaction drawing (the same text as the
    // drawing after the drop, tests/cd-live.js), put in place of their groups as copies; the glyph's place follows it
    var cdLive;
    function __run4() {   // run at start, in order (__start)
    shared.cdBase = null, cdLive = null;
    }
    function cdSession() {
      if (!shared.cd || !cdJs || !cdJs.live || !shared.cdBase) return null;
      if (cdLive && cdLive.base === shared.cdBase) return cdLive.s;
      try { cdLive = { base: shared.cdBase, s: cdJs.live(shared.cdBase.now, shared.cdBase.text) }; } catch (e) { cdLive = null; }
      return cdLive ? cdLive.s : null;
    }
    function cdSessionSoon() {
      if (!shared.cdBase && shared.cd) shared.cdBase = { now: shared.cd.now, text: shared.text };   // a drawing taken as it is (adopt): the file opened, its GraphML
      (window.requestIdleCallback || function (f) { setTimeout(f, 0); })(function () { if (on) cdSession(); });
    }
    // the compartments and complexes growing round a move (ks, from liveDraw), drawn by cdrender's own code at their live
    // boxes (cd_edit.live's holder) in place of what their groups hold, until the map is drawn again (undraw puts it
    // back); drawn again only when a box changed, all in one parse per frame
    function cdHolders(ks) {
      var S = cdSession();
      if (!S || !S.holder) return;
      var todo = ks.filter(function (i) {
        var R = shared.liveOrig[i], b = shared.liveC[i];
        return !(R && R.at && R.at.every(function (v, j) { return v === b[j]; }));
      }).map(function (i) { return [i, S.holder(nodes2[i].id, toPic(shared.liveC[i]))]; }).filter(function (q) { return q[1] != null; });
      if (!todo.length) return;
      var doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + todo.map(function (q) { return '<g>' + q[1] + '</g>'; }).join('') + '</svg>', 'image/svg+xml').documentElement;
      var parts = Array.prototype.filter.call(doc.childNodes, function (c) { return c.nodeType === 1; });
      todo.forEach(function (q, k) {
        var i = q[0], g = gN[nodes2[i].id];
        if (!shared.liveOrig[i]) { var kids = Array.prototype.slice.call(g.childNodes); shared.liveOrig[i] = { back: function () { g.replaceChildren.apply(g, kids); } }; }
        shared.liveOrig[i].at = shared.liveC[i].slice();
        g.replaceChildren.apply(g, Array.prototype.map.call(parts[k].childNodes, function (c) { return document.importNode(c, true); }));
      });
    }
    // the CellDesigner part of the live drawing of a move (live.js, liveFmt): its process glyphs following their segments, its
    // reactions drawn by the drop's own code, its holders drawn by cdrender
    // a species resized by its handles drawn by cdrender at its live box (sizeLive, live.js): R its record, made with no box,
    // put back by liveBack
    function cdSizeLive(i, nb, R) {
      var S = cdSession(), g = gN && gN[nodes2[i].id];
      if (!S || !S.holder || !g) return R;
      if (!R) { var kids = Array.prototype.slice.call(g.childNodes); return { i: i, back: function () { g.replaceChildren.apply(g, kids); } }; }
      if (!nb || (R.at && R.at.every(function (v, j) { return v === nb[j]; }))) return R;
      var svg = S.holder(nodes2[i].id, toPic(nb));
      if (svg == null) return R;
      var doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><g>' + svg + '</g></svg>', 'image/svg+xml').documentElement.firstElementChild;
      g.replaceChildren.apply(g, Array.prototype.map.call(doc.childNodes, function (c) { return document.importNode(c, true); }));
      R.at = nb.slice();
      return R;
    }
    var liveCd, RXE;
    function __run5() {   // run at start, in order (__start)
    liveCd = { glyphs: glyphFollow, lines: cdLines, holders: cdHolders, size: cdSizeLive };
    RXE = /^(.*)\|(a|b|[rpmi]\d+)$/;
    }   // i: an input of a gate between entities
    function cdLines(ks, pp) {   // false: not drawn this way (the copies of fullLines then)
      if (!shared.cd || !gE) return false;
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
        bends.set(e.id, e.pts.map(function (pi) { return toPic(pt(pi)); }));   // in the picture's frame, as the live session reads the file
        if (!e.path) return;
        var q = ['sx', 'sy', 'tx', 'ty'].map(function (a) { return parseFloat(e.path.getAttribute(a)) || 0; });
        var no = e.path.getAttribute('spot'); if (no) q.push(parseInt(no, 10));   // a modifier's place round its glyph
        if (pp && pp.to && pp.k === k) { var j = pp.end ? 2 : 0; q[j] = pp.to[0]; q[j + 1] = pp.to[1]; no = spotNo(pp, pp.to); if (no) q[4] = no; }
        paths.set(e.id, q);
      });
      // the boxes of every node of those reactions as they are now (also when the drawing on screen is older than the
      // file, a redraw under way)
      edges2.forEach(function (e) {
        var m = e.id.match(RXE);
        if (!m || !rids.has(m[1])) return;
        [e.s, e.t].forEach(function (i) { if (i != null && !/\|proc$/.test(nodes2[i].id)) boxes.set(nodes2[i].id, toPic(bx(i))); });
      });
      // an end over another node: the reaction written with it there, as the drop writes it (cd_edit rewire)
      var ends = null;
      if (pp && pp.to && pp.n2 != null && rids.has((edges2[pp.k].id.match(RXE) || [])[1])) {
        var ep = edges2[pp.k];
        ends = new Map([[ep.id, [nodes2[pp.end ? ep.s : pp.n2].id, nodes2[pp.end ? pp.n2 : ep.t].id]]]);
        boxes.set(nodes2[pp.n2].id, toPic(bx(pp.n2)));
      }
      var list = Array.from(rids), out = S.frame(boxes, bends, paths, list, ends);
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
            shared.copies.push([el, orig, id && byE[id] != null ? byE[id] : null]);
          });
        });
        // the glyph where it is drawn now (selection, guides, the ends of the lines at it)
        var gi = nodes2.findIndex(function (n) { return n.id === rid + '|proc'; }), r0 = S.rest(rid);
        if (gi >= 0 && r0 && f.sq) {
          shared.liveG = shared.liveG || {};
          shared.liveG[gi] = [f.sq[0] - r0[0][0], f.sq[1] - r0[0][1], f.ang - r0[1], r0[2] ? f.len / r0[2] : 1, [r0[0][0] + picOff()[0], r0[0][1] + picOff()[1], r0[1], r0[2]]];   // the rest place in the editor's frame, as glyphFollow's
        }
      });
      return true;
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
    // a CellDesigner drawing's white canvas left out while editing (an unbounded space, as a
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
    // Edit tab is (two small JavaScript files, so opening for editing does not wait on them)
    function cdMap(m) { var d = m && m.downloads && m.downloads[0]; return !!(d && d.label === 'CellDesigner'); }
    var warm;
    function __run6() {   // run at start, in order (__start)
    warm = null;
    }
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
    function __run7() {   // run at start, in order (__start)
    warmUp();
    }

    export function __start() { __run1(); __run2(); __run3(); __run4(); __run5(); __run6(); __run7(); }   // the part's statements, in their order
    export { beyond, cdDraw, cdGraphml, cdJs, cdKnown, cdMap, cdMk, cdNow, cdRebuild, cdRemember, cdSessionSoon, cdpy, glyphArcs, glyphPort, isCd, joinAt, joinGuides, joinSolve, lineGrid, liveCd, nodeCentre, nodePlaces, plainCanvas, warmUp };
