import { shared, V } from './state.js';
import { boxOf, drag, edges2, f1, gE, gN, gridBlock, lastFor, lastSvg, nodes2, num, on, parse, placed, points, pt, rebase, setText, spotNo, status, undo, warn } from './core.js';
import { bx, dropCopies, picOff, toPic } from './live.js';
import { glyphMid } from './geometry.js';
import { cdCardDown, cdCheck, cdClsOf, cdHow, cdLineAt, cdLink, cdLinkMarks, cdLiveEnds, cdMoveSays, cdNameOf, cdPal, cdOnLine, cdRename, cdRole, cdSsTyped, cdStartOk, cdFeat, cdFront, cdSvDelete, cdSvFar, cdSvList, cdSvMove, cdSvOpen } from './cdcreate.js';

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
    cdp = null, cdJs = null, cdMk = null;
    }   // the CellDesigner side loading, once loaded (cd_edit, cd_make), the file edited ({ base, now })
    function isCd(t) { return /<sbml[\s>]/.test(t.slice(0, 3000)) && t.indexOf('celldesigner') >= 0; }
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
    // a process glyph not moved itself stays midway on its segment of the main line wherever that goes (cd_edit), so
    // while a drag or the keys move a segment's end it follows at once (not only on
    // release): procs, each glyph with its two main arcs; liveG, the glyphs' shifts until the map is drawn again
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
    function cdDraw(t, g, fit) {   // [svg, file, GraphML]; the new file's document kept for the session while editing
      return cdJs.draw(t, g, { fit: fit == null ? undo.length > 0 : fit, block: gridBlock(), parsed: on ? function (c, d) { cdDocKeep(c, d, shownId()); } : null });
    }
    // a CellDesigner file's XML parsed once for every reader of that text (cdrender's drawing on adding, cd_edit's GraphML
    // at the read-ahead or the opening, its live session after entry, the drawing and GraphML after a change): one
    // document kept, the shown map's, as the readers only read it (cd_edit.place parses its own). id: the map it is kept
    // for (by default the map shown); false: parsed, not kept (a map read ahead that is not shown, a folder's file);
    // 'adding': a file being added, whose map is the next one shown. Let go when another map is shown (cdShown), the
    // live session made from it with it
    var cdDocNow;   // { t, doc, id }; none at the start
    function shownId() { return V.chosen ? V.chosen.id : null; }
    function cdDoc(t, id) {
      if (cdDocNow && cdDocNow.t === t) return cdDocNow.doc;
      var doc = new DOMParser().parseFromString(t, 'application/xml');
      if (id !== false) cdDocKeep(t, doc, id === undefined ? shownId() : id);
      return doc;
    }
    function cdDocKeep(t, doc, id) { cdDocNow = { t: t, doc: doc, id: id }; }
    function cdKept() { return cdDocNow ? cdDocNow.id : null; }   // the map whose document is kept (the tests' view)
    function cdShown(id) {   // a map shown (the viewer's left)
      if (!cdDocNow) return;
      if (cdDocNow.id === 'adding') cdDocNow.id = id;
      else if (cdDocNow.id !== id) { cdDocNow = null; cdLive = null; }   // the live session reads it too
    }
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
    function cdRebuild(t, sh) { shared.cd.base = t; setText(cdGraphml(t)); rebase(sh[0], sh[1]); }
    function cdGraphml(t) {
      var g = cdKnown(t);
      if (g) return g;
      g = cdJs.graphml(t, null, { doc: cdDoc(t) });
      cdRemember(t, g);
      return g;
    }
    function cdKnown(t) { for (var i = 0; i < cdMemo.length; i++) if (cdMemo[i][0] === t) return cdMemo[i][1]; return null; }   // without adding to the memo
    function cdRemember(t, g) { cdMemo.unshift([t, g]); cdMemo.length = Math.min(cdMemo.length, 3); }   // also the editor's own text on leaving (keepAhead)
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
    cdLive = null;
    }
    function cdSession() {
      if (!shared.cd || !cdJs || !cdJs.live || !shared.cdBase) return null;
      if (cdLive && cdLive.base === shared.cdBase) return cdLive.s;
      try { cdLive = { base: shared.cdBase, s: cdJs.live(shared.cdBase.now, shared.cdBase.text, { doc: cdDoc(shared.cdBase.now) }) }; } catch (e) { cdLive = null; }
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

    // CellDesigner's way to put a species into a complex (state.js F.join), with cd_make, into the file and the GraphML made
    // again from it; its process glyphs and gates never join
    function cdJoin() {
      return {
        ok: function () { return !!cdMk && !!cdMk.join; },
        own: placed,
        joinable: function (id, cid) { return cdMk.joinable(shared.cd.now, id, cid); },
        write: function (joins) {   // the complexes that took a member
          var N = cdNow(), t = N.t, done = [];
          joins.forEach(function (q) { try { t = cdMk.join(t, q[0], q[1]); done.push(q[1]); } catch (err) { warn(String(err && err.message || err)); } });
          if (done.length) cdRebuild(t, N.sh);
          return done;
        }
      };
    }
    export function __start() { __run1(); __run3(); __run4(); __run5(); __run6(); __run7(); }   // the part's statements, in their order
    // drawing a line (create.js linkEnd, linkDown, linkHow, moveSays, linkMake, linkPaint), CellDesigner's way (cdcreate.js)
    function cdLine() {
      return { role: cdRole, lineAt: cdLineAt, onLine: cdOnLine, startOk: cdStartOk, how: cdHow, moveSays: cdMoveSays, make: cdLink, liveEnds: cdLiveEnds, marks: cdLinkMarks };
    }
    // state variables and units of information (create.js svList, svAt, svMove, svDelete, typeIn), CellDesigner's own:
    // residues, the structural state and the unit of information read from and written into its file (cdcreate.js)
    function cdSv() {
      return { list: cdSvList, box: function (i) { return cdFront(i, cdFeat(nodes2[i].id)); }, open: cdSvOpen, move: cdSvMove, del: cdSvDelete, unitStays: true, on: cdPal, far: cdSvFar, typed: cdSsTyped };
    }
    // a reaction lit whole (core.js lit): a main line or its square selected lights all its lines (hlE, line indices) and
    // its square (glyphs, node indices)
    function cdLit(hlE, glyphs) {
      var rx = new Set();
      var F = shared.F, of = function (id) { return id.slice(0, id.lastIndexOf('|')); };   // a line's reaction
      shared.selE.forEach(function (k) { if (/\|[ab]$/.test(edges2[k].id)) rx.add(of(edges2[k].id)); });
      shared.selN.forEach(function (i) { var r = F.square(nodes2[i].id); if (r != null) rx.add(r); });
      if (!rx.size) return;
      edges2.forEach(function (e, k) { if (F.ownLine(e.id) && rx.has(of(e.id))) hlE.add(k); });
      nodes2.forEach(function (n, i) { var r = F.square(n.id); if (r != null && rx.has(r)) glyphs.add(i); });
    }
    // an end of line k moved to node i (core.js takes0, full editing): a reaction's end at a species, to another species or
    // complex (no member, no compartment, no glyph or gate, none the reaction has already); its other end at a species or at
    // the reaction's glyph, never a gate's line (cd_edit rewire)
    function cdEndTo(k, end, i) {
      var e = edges2[k], nd = nodes2[i], here = end ? e.t : e.s, proc = function (x) { return /\|(proc|g\d*)$/.test(nodes2[x].id); }, rid = e.id.slice(0, e.id.lastIndexOf('|') + 1);
      if (edges2.some(function (f) { return f.id.indexOf(rid) === 0 && (f.s === i || f.t === i); })) return false;
      return !proc(here) && !/\|g\d*$/.test(nodes2[end ? e.s : e.t].id) && !proc(i) && !nd.comp && !(nd.up != null && !nodes2[nd.up].comp);
    }
    // a member that left its complex (Shift) made a species of the compartment it went to (cd_make.leave), the GraphML made
    // again from the file (core.js settle); moves: [[id, new holder id or null], ...]. Whether the file changed
    function cdLeave(moves) {
      if (!cdMk || !moves.some(function (m) { try { return !!cdMk.aliasInfo(shared.cd.now, m[0]).complex; } catch (err) { return false; } })) return false;
      var N = cdNow(), t = N.t, t0 = t;
      moves.forEach(function (m) { try { if (cdMk.aliasInfo(t, m[0]).complex) t = cdMk.leave(t, m[0], m[1]); } catch (err) { warn(String(err && err.message || err)); } });
      if (t === t0) return false;
      cdRebuild(t, N.sh);
      return true;
    }
    // the map drawn now (core.js render, state.js F.redraw): the moves written into the file, drawn by cdrender, and the
    // GraphML made of it again; memo: the drawing made ahead unfitted, as the map before any change, used only on this Grid
    // size's block. [svg, warnings]
    function cdRedraw(memo) {
      var dm = memo && memo.cd && memo.base === shared.cd.base && memo.text === shared.text && memo.block === gridBlock() && !undo.length ? memo : null;
      var q = dm ? dm.q : cdDraw(shared.cd.base, shared.text);
      shared.cd.now = q[1]; shared.cdBase = { now: q[1], text: q[2] };   // what the live drawing of a move starts from
      if (q[2] !== shared.text && !drag) {   // the same map, its new bend points (a glyph moved) now its own
        var ids = shared.selN.map(function (i) { return nodes2[i].id; }), np = points.length;
        setText(q[2]); parse();
        shared.selN = ids.map(function (id) { return nodes2.findIndex(function (n) { return n.id === id; }); }).filter(function (i) { return i >= 0; });
        if (points.length !== np) { shared.selP = []; shared.selE = []; }
      }
      return [q[0], []];
    }
    // why a file read as CellDesigner cannot be drawn, in a reader's words (the reader's own error, in the converter's
    // Python wording, says nothing to a person): a model of SBML Level 3, which CellDesigner never writes; a drawing whose
    // species the model no longer has (a tool such as COPASI changed the model after CellDesigner saved it, keeping the
    // drawing as it was); else the drawing unreadable. The error itself goes to the console.
    function cdWhy(t, e) {
      var m = String(e && e.message || e), head = t.slice(0, 3000);
      if (typeof console !== 'undefined') console.warn('CellDesigner reading: ' + m);
      if (!/^(AttributeError|KeyError|TypeError|ValueError|IndexError|Error)\b/.test(m) && !/NoneType|not subscriptable|index out of range/.test(m)) return m;   // already in words
      var by = /metaid="COPASI/.test(head) ? 'COPASI' : 'another tool';
      if (/<sbml\b[^>]*\blevel="3"/.test(head)) return 'an SBML Level 3 file holding CellDesigner\u2019s notes from an earlier version (CellDesigner writes Level 2): ' + by + ' wrote it after CellDesigner, and SBML files are not opened here yet';
      if (/^KeyError/.test(m)) return 'its CellDesigner drawing names species its model no longer has: ' + by + ' changed the model after CellDesigner saved it, so the drawing cannot be matched to it';
      return 'its CellDesigner drawing could not be read: a part CellDesigner writes is missing or written another way';
    }
    // CellDesigner's format object (state.js formats): the file is kept beside the GraphML edited, the moves written in
    function cdFormat() {
      return { name: 'cd', load: cdpy, engineCd: true, now: function () { return shared.cd.now; }, ownFrame: true, live: function () { return liveCd; }, cardDown: cdCardDown, mainLines: true, afView: false, stacks: false, insets: false, magenta: true, opened: plainCanvas, drawn: cdSessionSoon, redraw: cdRedraw, lit: cdLit, endTo: cdEndTo, undoKeep: function () { return { g: shared.text, b: shared.cd.base }; }, undoPut: function (t) { shared.cd.base = t.b; return t.g; }, leave: cdLeave, nestReady: function () { return !!cdJs && !!cdJs.nestCheck; }, nestWhy: function (moves) { return cdJs && cdJs.nestCheck ? cdJs.nestCheck(shared.cd.now, moves, { doc: cdDoc(shared.cd.now) }) : null; }, modLine: function (id) { return /\|m\d+$/.test(id); }, ownLine: function (id) { return /\|(a|b|r\d+|p\d+)$/.test(id); }, fileType: { description: 'CellDesigner', accept: { 'application/xml': ['.xml'] } }, join: cdJoin(), line: cdLine(), sv: cdSv(), square: function (id) { var m = /^(.*)\|proc$/.exec(id); return m ? m[1] : null; }, beside: function () { return shared.cd.now; },
        // a line's end at one of a node's places only, as a CellDesigner file keeps a species' line: places that follow each
        // node's size and so meet no line grid, its bend points lined up by the guides alone (state.js fixedEnds)
        fixedEnds: true, places: nodePlaces,
        reads: isCd, entry: cdMap,
        // opening: CellDesigner's open arrowhead taken in as SBGN's open triangle (cd_make sbgn): the editor works on the
        // changed text, written at the next save, the change said once the map is drawn; the file as it was stays the
        // site's base (what GitHub and the site hold)
        open: function (t, g0, still) {
          return cdpy().then(function () {
            if (!still()) return null;
            var sg = cdMk ? cdMk.sbgn(t) : { n: 0 }, t0 = t, said = null;
            if (sg.n) { t = sg.text; said = sg.n + (sg.n > 1 ? ' positive influences' : ' positive influence') + ' (open arrowhead, not SBGN) made reduced physical stimulation (open triangle).'; }
            return { g: cdGraphml(t), t: t, t0: t0, said: said, own: { cd: { base: t, now: t } } };
          });
        },
        // a reader's own map drawn for the list (core.js drawText) by cdrender; keep: 'adding' when the map is shown next
        // (its document kept for it, cdDoc)
        drawOwn: function (t, g0, keep) { return cdpy().then(function () { return window.cdrender.render(cdDoc(t, keep || false), { classes: true, groups: true }); }).catch(function (e) { throw new Error(cdWhy(t, e)); }); },
        asGraphml: function (t) { return cdJs ? cdGraphml(t) : t; },   // the site's file as the editor's GraphML (the reference of the site's drawing)
        // the read-ahead: the GraphML of its file (its document kept for the map shown), drawn by cdrender; that GraphML
        // handed to the opening (took); the drawing kept on leaving, with the file it was made from (keeper)
        ahead: { load: cdpy, graphml: function (t, b, keep) { return cdKnown(t) || cdJs.graphml(t, null, { doc: cdDoc(t, keep) }); }, took: cdRemember,
          draw: function (t, g) { return { cd: true, base: t, text: g, q: cdDraw(t, g, false), block: gridBlock() }; },
          keeper: function () { return function (t, g, svg) { cdRemember(t, g); return { cd: true, base: t, text: g, q: [svg, t, g] }; }; } },
        kind: function (n) { var c = cdClsOf(n.id); return c ? c[0] : n.comp ? 'compartment' : null; },   // its species class, or compartment
        ownName: cdNameOf, rename: cdRename, nameable: function () { return !!cdMk; } };   // names read from and written into its file
    }
    export { cdFormat, cdKept, cdJs, cdMap, cdMk, cdNow, cdRebuild, cdSessionSoon, cdShown, cdpy, isCd, liveCd, nodePlaces, plainCanvas, warmUp };
