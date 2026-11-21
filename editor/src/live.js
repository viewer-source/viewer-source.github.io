    // ---------- the live drawing of a move (editor/src/live.js) ----------
    // What a drag, a held arrow key, a dragged port or a resize shows before the release, on every format: the groups of
    // what moves shifted (shift, keyShift, unshift), the holders growing round it (liveFit, liveDraw, liveRec), a node
    // resized by its handles (sizeLive), the lines it touches drawn in full (liveLines, fullLines), all in the picture's
    // frame (picOff, toPic). A format with a way of its own gives it through liveFmt(): CellDesigner (liveCd, celldesigner.js)
    // its process glyphs following their segments, its reactions drawn by the drop's code and its holders by cdrender;
    // GraphML and SBGN-ML maps (liveY, graphml.js) their arcs and the processes and gates at them drawn by the yEd
    // renderer. What is drawn here is put back when the map is drawn again.
    function liveFmt() { return cd ? liveCd : liveY; }
    // compartments are containers: resized by dragging an edge or a handle, and grown by themselves
    // when what they hold is moved past their margin; liveC: their boxes while a drag runs (index in nodes2 -> box),
    // drawn on the picture at once, until the renderer has drawn the map again
    // liveOrig: per holder drawn live, how to put back what the renderer drew (liveRec's record, or a CellDesigner
    // holder's { back, at }: liveBack)
    var liveC = null, liveOrig = null;
    function bx(i) { if (poseNow && poseNow[i]) return poseNow[i].box; if (liveC && liveC[i]) return liveC[i]; var b = boxOf(i);
      if (liveG && liveG[i]) return [b[0] + liveG[i][0], b[1] + liveG[i][1], b[2], b[3]]; return mv && mv.n.has(i) ? [b[0] + mv.dx, b[1] + mv.dy, b[2], b[3]] : b; }
    // the holders round what moves (and round the one resized) grown as on release (grown), drawn at once; seed: the
    // box of the one resized, which grows its holder only in Layout editing (in Full one resized past it leaves it) or
    // when it is no compartment (a macromolecule resized by its handles)
    function liveFit(seed) {
      liveC = seed || null;
      var ks = seed ? Object.keys(seed).map(Number).filter(function (i) { return !full() || !nodes2[i].comp; }) : mv && drag ? tops(mv.n, drag.alone) : [];
      var nb = ks.length ? grown(ks, bx, boxOf, function (k) { return !!(mv && mv.n.has(k)); }, drag && drag.away) : {};
      liveC = Object.assign({}, seed || {}, nb);
      if (!Object.keys(liveC).length) liveC = null;
      liveDraw(seed ? Object.keys(seed).map(Number).filter(function (i) { return !holds(i); }) : []);
      return Object.keys(nb).some(function (k) { return nodes2[+k].comp; });   // a compartment grows round what moves
    }
    function undraw(i) {   // a holder drawn as the renderer drew it again
      if (liveOrig && liveOrig[i]) liveBack(liveOrig[i]);
      if (liveOrig) delete liveOrig[i];
    }
    // the picture's frame: a CellDesigner picture is in the file's places, which a shift (out of negative places or the canvas
    // fit, cd_edit.place) puts x0, y0 from the editor's (the frame's two translates cancel inside the picture); a GraphML
    // picture is in the editor's own. Everything put into the picture during a move (the selection's fill, the live
    // reactions, the holders growing) is placed through it, the one place this is reckoned
    function picOff() { return cd ? [x0, y0] : [0, 0]; }
    function toPic(b) { var o = picOff(); return b.length > 2 ? [b[0] - o[0], b[1] - o[1], b[2], b[3]] : [b[0] - o[0], b[1] - o[1]]; }
    function liveOff() { liveC = null; if (liveOrig) Object.keys(liveOrig).forEach(function (i) { undraw(+i); }); liveOrig = null; }
    function shift() {   // the drag shown on the drawing itself: groups moved, arcs touched hidden (drawn live)
      if (!gN || !mv) return false;
      if (!mv.dx && !mv.dy) { unshift(); return true; }   // back where it started: the arcs drawn as the renderer drew them
      poseBack();
      var tr = 'translate(' + mv.dx + ' ' + mv.dy + ')';
      mv.n.forEach(function (i) { var g = gN[nodes2[i].id]; if (g) g.setAttribute('transform', tr); });
      live = live || new Set();
      posed();
      edges2.forEach(function (e, k) {
        var a = mv.n.has(e.s), b = mv.n.has(e.t), some = e.pts.some(function (p) { return mv.p.has(p); });
        var gs = gE[e.id];   // a CellDesigner line has two groups, its halo's and its own
        if (!gs || !(a || b || some)) return;
        if (a && b) gs.forEach(function (g) { g.setAttribute('transform', tr); });
        else { gs.forEach(function (g) { g.style.display = 'none'; }); live.add(k); }
      });
      liveFmt().glyphs(mv.n, mv.p, null);
      return true;
    }
    function unshift() {   // the drawing as it was: a press that moved nothing leaves nothing hidden or shifted
      if (gN) Object.keys(gN).forEach(function (k) { gN[k].removeAttribute('transform'); });
      if (gE) Object.keys(gE).forEach(function (k) { gE[k].forEach(function (g) { g.removeAttribute('transform'); g.style.display = ''; }); });
      poseBack(); live = null; liveG = null; liveOff(); dropCopies(); frozen = false;
    }
    // a node shown during a drag as the release will place it, turned and moved (a submap's terminal held on its border,
    // its way by its side): each function of livePose(sets, alone, out) puts into out, by node index, { box, way, turn }
    // (turn: degrees from the way it is drawn); the node's drawing is turned round its centre to that box, its texts kept
    // upright, its lines drawn live to its ports turned with it (bx, posePort, drawnShape)
    var livePose = [], poseNow = null, poseText = null;
    function posed() {
      var out = {};
      livePose.forEach(function (f) { f(mv, !!(drag && drag.alone), out); });
      if (!Object.keys(out).length) return;
      poseNow = out; poseText = new Map();
      var o = picOff();
      Object.keys(out).forEach(function (k) {
        var i = +k, p = out[k], b = boxOf(i), g = gN[nodes2[i].id];
        if (!g) return;
        var c0 = [b[0] + b[2] / 2 - o[0], b[1] + b[3] / 2 - o[1]], c1 = [p.box[0] + p.box[2] / 2 - o[0], p.box[1] + p.box[3] / 2 - o[1]];
        g.setAttribute('transform', 'translate(' + f1(c1[0]) + ' ' + f1(c1[1]) + ') rotate(' + p.turn + ') translate(' + f1(-c0[0]) + ' ' + f1(-c0[1]) + ')');
        if (p.turn) g.querySelectorAll('text').forEach(function (el) {   // turned back round the same centre: the label moves as one, its lines stacked as drawn
          var was = el.getAttribute('transform'); poseText.set(el, was);
          el.setAttribute('transform', 'rotate(' + (-p.turn) + ' ' + f1(c0[0]) + ' ' + f1(c0[1]) + ')' + (was ? ' ' + was : ''));
        });
        edges2.forEach(function (e, j) { if ((e.s === i || e.t === i) && gE && gE[e.id]) { gE[e.id].forEach(function (q) { q.style.display = 'none'; }); live.add(j); } });
      });
    }
    function poseBack() {   // the nodes posed drawn as before (those the move still shifts get their shift again from shift)
      if (poseText) poseText.forEach(function (v, el) { if (v == null) el.removeAttribute('transform'); else el.setAttribute('transform', v); });
      if (poseNow && gN) Object.keys(poseNow).forEach(function (k) { var g = gN[nodes2[+k].id]; if (g && !(mv && mv.n.has(+k))) g.removeAttribute('transform'); });
      poseNow = null; poseText = null;
    }
    function posePort(i, off, k) {   // a line's port on node i as its pose places it (else turned with it)
      var p = poseNow && poseNow[i];
      if (!p) return off;
      if (p.ports && p.ports[k]) return p.ports[k];
      if (!p.turn) return off;
      var a = p.turn * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      return [off[0] * c - off[1] * s, off[0] * s + off[1] * c];
    }
    function keyShift(ks, dx, dy) {   // the keys' move on the drawing: groups moved by the sum since the last drawing, arcs touched drawn live
      if (!gN) return;
      keyed = keyed || { n: new Set(), p: new Set(), dx: 0, dy: 0 };
      frozen = false; keyed.dx += dx; keyed.dy += dy; ks.n.forEach(function (i) { keyed.n.add(i); }); ks.p.forEach(function (i) { keyed.p.add(i); });
      var tr = 'translate(' + keyed.dx + ' ' + keyed.dy + ')';
      keyed.n.forEach(function (i) { var g = gN[nodes2[i].id]; if (g) g.setAttribute('transform', tr); });
      live = live || new Set();
      edges2.forEach(function (e, k) {
        var a = ks.n.has(e.s), b = ks.n.has(e.t), some = e.pts.some(function (p) { return ks.p.has(p); });
        var gs = gE[e.id];
        if (!gs || !(a || b || some)) return;
        gs.forEach(function (g) { g.style.display = 'none'; }); live.add(k);   // the file has the new places: drawn from them
      });
      liveFmt().glyphs(keyed.n, keyed.p, [keyed.dx, keyed.dy]);
    }
    // the arcs following a move drawn in full, so a drag feels natural:
    // each a copy of the renderer's own group of that arc, so it keeps its colour, width and
    // dashes; its line goes through the new places, and what is drawn at an end (arrowhead, circle, bar) is carried to
    // that end, turned as the end's segment turned. The originals are hidden; the copies go when the map is drawn again
    var copies = [], frozen = false;
    function restBox(i) { var b = boxOf(i), k = keyed && keyed.n.has(i); return k ? [b[0] - keyed.dx, b[1] - keyed.dy, b[2], b[3]] : b; }
    function restPt(pi) { var p = points[pi], k = keyed && keyed.p && keyed.p.has(pi); return [num(p, 'x') - (k ? keyed.dx : 0), num(p, 'y') - (k ? keyed.dy : 0)]; }
    function dropCopies() {   // the copies taken away, an original shown again unless its arc still follows a move
      copies.forEach(function (c) { c[0].remove(); if (c[1] && !(live && live.has(c[2]))) c[1].style.display = ''; });
      copies = [];
    }
    // a point of the old drawing of an arc taken to the new one: it goes with the segment it lies nearest to, at the
    // same side distance; along it, within 15 units of a segment's end it keeps its distance from that end (arrowheads,
    // rounded bends, a line's cut end), else its share of the segment (a mark midway, a line drawn in two pieces)
    function follow(o, n) {
      var seg = [];
      for (var i = 1; i < o.length; i++) {
        var a = o[i - 1], b = o[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), a1 = n[i - 1], b1 = n[i], L1 = Math.hypot(b1[0] - a1[0], b1[1] - a1[1]);
        seg.push({ a: a, L: L, u: L ? [(b[0] - a[0]) / L, (b[1] - a[1]) / L] : [1, 0], a1: a1, L1: L1, u1: L1 ? [(b1[0] - a1[0]) / L1, (b1[1] - a1[1]) / L1] : (L ? [(b[0] - a[0]) / L, (b[1] - a[1]) / L] : [1, 0]) });
      }
      return function (p) {
        var best = null, bd = Infinity;
        seg.forEach(function (S, k) {
          var x = p[0] - S.a[0], y = p[1] - S.a[1], t = x * S.u[0] + y * S.u[1], c = Math.max(0, Math.min(S.L, t));
          var d = Math.hypot(x - c * S.u[0], y - c * S.u[1]) + (t < 0 && k > 0 ? 1e-6 : 0);
          if (d < bd) { bd = d; best = [S, t, -x * S.u[1] + y * S.u[0]]; }
        });
        var S = best[0], t = best[1], w = best[2];
        var nA = t <= 15, nB = S.L - t <= 15;
        if (nA && nB) { nA = t <= S.L - t; nB = !nA; }   // a short segment: the nearer end (else a line's end 1.5 units from a new bend goes with the bend)
        var t1 = nA || S.L <= 0 ? t : nB ? S.L1 - (S.L - t) : t * S.L1 / S.L;
        return [S.a1[0] + t1 * S.u1[0] - w * S.u1[1], S.a1[1] + t1 * S.u1[1] + w * S.u1[0]];
      };
    }
    // what is drawn at an end of an arc (an arrowhead, a circle, a bar) carried whole with that end and turned as its end
    // segment turned, so its shape never changes (else an arrowhead stretches to a long thin triangle when
    // its segment was short, follow taking its base corners as near the segment's start); null for anything else.
    // c: the shape's centre; P: its points, for an open shape (only a bar across the end segment counts)
    function endShape(o, n, c, P) {
      var L = o.length - 1, best = null, bd = 25;
      [[o[L], o[L - 1], n[L], n[L - 1]], [o[0], o[1], n[0], n[1]]].forEach(function (E) {
        var d = Math.hypot(c[0] - E[0][0], c[1] - E[0][1]);
        if (d < bd) { bd = d; best = E; }
      });
      if (!best) return null;
      var A = best[0], B = best[1], A1 = best[2], B1 = best[3], l = Math.hypot(A[0] - B[0], A[1] - B[1]), l1 = Math.hypot(A1[0] - B1[0], A1[1] - B1[1]);
      var u = l ? [(A[0] - B[0]) / l, (A[1] - B[1]) / l] : [1, 0], u1 = l1 ? [(A1[0] - B1[0]) / l1, (A1[1] - B1[1]) / l1] : u;
      if (P) {
        if (P.length !== 2) return null;
        var dx = P[1][0] - P[0][0], dy = P[1][1] - P[0][1], dl = Math.hypot(dx, dy);
        if (!dl || Math.abs(dx * u[0] + dy * u[1]) / dl > 0.2) return null;
      }
      return function (p) {
        var x = p[0] - A[0], y = p[1] - A[1], t = x * u[0] + y * u[1], w = -x * u[1] + y * u[0];
        return [A1[0] + t * u1[0] - w * u1[1], A1[1] + t * u1[1] + w * u1[0]];
      };
    }
    // a bend point the renderer's drawing does not have yet (made by grabbing the line in this drag, else the
    // line stays straight until the release) put into the drawn line where it lies, so follow takes it to its new place.
    // str: a path's d (M, L, Q, C) or a polyline's points; R: the arc's bend points at rest
    function withBends(str, R) {
      var tk = str.match(/[MLQCZ]|-?[\d.]+(?:e-?\d+)?/gi) || [], poly = !/[A-Z]/i.test(str);
      if (poly) { var q = ['M']; tk.forEach(function (x, i) { if (i > 0 && i % 2 === 0) q.push('L'); q.push(x); }); tk = q; }
      var segs = [], seen = [], cur = null, N = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };
      for (var i = 0; i < tk.length;) {
        var c = tk[i], m = N[c];
        if (m == null) return str;   // relative or implicit commands: left as drawn
        var a = tk.slice(i + 1, i + 1 + m).map(Number);
        for (var j = 0; j + 1 < a.length; j += 2) seen.push([a[j], a[j + 1]]);
        if (c === 'L' && cur) segs.push({ at: i, a: cur });
        if (m) cur = [a[m - 2], a[m - 1]];
        i += 1 + m;
      }
      var add = [];
      R.forEach(function (r) {
        if (seen.some(function (s) { return Math.hypot(s[0] - r[0], s[1] - r[1]) < 0.5; })) return;
        segs.some(function (s) {
          var b = [+tk[s.at + 1], +tk[s.at + 2]], dx = b[0] - s.a[0], dy = b[1] - s.a[1], L = dx * dx + dy * dy;
          if (!L) return false;
          var t = ((r[0] - s.a[0]) * dx + (r[1] - s.a[1]) * dy) / L;
          if (t <= 0 || t >= 1 || Math.hypot(s.a[0] + dx * t - r[0], s.a[1] + dy * t - r[1]) > 1.5) return false;
          add.push([s.at, t, r]); return true;
        });
      });
      if (!add.length) return str;
      add.sort(function (x, y) { return y[0] - x[0] || y[1] - x[1]; });   // from the end, so the places before stay
      add.forEach(function (x) { tk.splice(x[0], 0, 'L', String(x[2][0]), String(x[2][1])); });
      if (poly) return tk.filter(function (x) { return !/^[ML]$/.test(x); }).reduce(function (s, x, i) { return s + (i % 2 ? ',' : i ? ' ' : '') + x; }, '');
      return tk.join(' ');
    }
    function fullLines(ks, pp) {   // ks: the arcs to draw (indices in edges2), pp: a port being dragged
      dropCopies();
      ks.forEach(function (k) {
        var e = edges2[k], gs = gE && gE[e.id];
        if (!gs) return;
        var o = line(k, restBox, restPt), n = line(k, null, null, pp);
        if (!o || !n) return;
        var F0 = follow(o, n), pair = function (str, closed) {   // every x y of an attribute taken along, an end's shape whole
          if (!closed) str = withBends(str, o.slice(1, -1));
          var v = str.match(/-?[\d.]+(?:e-?\d+)?/g) || [], k2 = 0, P = [];
          for (var i = 0; i + 1 < v.length; i += 2) P.push([+v[i], +v[i + 1]]);
          var c = P.reduce(function (s, q) { return [s[0] + q[0] / P.length, s[1] + q[1] / P.length]; }, [0, 0]);
          var F = (P.length && endShape(o, n, c, closed ? null : P)) || F0;
          return str.replace(/-?[\d.]+(?:e-?\d+)?/g, function (m) {
            var j = k2++; if (j % 2) return f1(F([+v[j - 1], +v[j]])[1]); return f1(F([+v[j], +v[j + 1]])[0]);
          });
        }, F = F0;
        gs.forEach(function (g) {
          g.style.display = 'none';
          var c = g.cloneNode(true);
          c.removeAttribute('data-e'); c.style.display = ''; c.classList.add('m2-ed-copy');
          g.parentNode.insertBefore(c, g.nextSibling); copies.push([c, g, k]);
          c.querySelectorAll('*').forEach(function (el) {
            var nm = el.localName;
            if ((nm === 'polyline' || nm === 'polygon') && !el.getAttribute('transform')) el.setAttribute('points', pair(el.getAttribute('points') || '', nm === 'polygon'));
            else if (nm === 'path' && !el.getAttribute('transform') && /^[MLQCZ\s\d.,e-]*$/.test(el.getAttribute('d') || '')) el.setAttribute('d', pair(el.getAttribute('d'), /Z\s*$/i.test(el.getAttribute('d'))));
            else if (nm === 'line') { var q1 = F([+el.getAttribute('x1'), +el.getAttribute('y1')]), q2 = F([+el.getAttribute('x2'), +el.getAttribute('y2')]);
              el.setAttribute('x1', f1(q1[0])); el.setAttribute('y1', f1(q1[1])); el.setAttribute('x2', f1(q2[0])); el.setAttribute('y2', f1(q2[1])); }
            else if (nm !== 'g' && nm !== 'title' && nm !== 'tspan') {   // anything else (a circle, a rect, a text) moved by its centre
              var b; try { b = el.getBBox(); } catch (x) { return; }
              var m = [b.x + b.width / 2, b.y + b.height / 2], q = (nm !== 'text' && endShape(o, n, m) || F)(m);
              el.setAttribute('transform', 'translate(' + f1(q[0] - m[0]) + ' ' + f1(q[1] - m[1]) + ')' + (el.getAttribute('transform') ? ' ' + el.getAttribute('transform') : ''));
            }
          });
        });
      });
    }
    // the arcs following a move, put into the picture by paint(): the format's own drawing where it has one (a
    // CellDesigner reaction by the drop's code), else copies of the renderer's groups (fullLines); before the
    // editor's own drawing is in the page, plain lines into out. Returns the port being dragged, if any
    function liveLines(out) {
      var pk0 = drag && drag.port && drag.port.to ? drag.port : null, lk = new Set(live || []);
      // an end over another node is drawn as the drop will draw it (a format's lines() with the new end); an end over
      // nothing follows as a copy, its glyph following its segment as at its node (one straight reaction, no kink)
      var free = pk0 && pk0.free;
      if (pk0) { liveFmt().glyphs(new Set(), new Set(), null, pk0); (live || []).forEach(function (k) { lk.add(k); }); lk.add(pk0.k); }
      if (gE) { if (!frozen) { if (lk.size) { if (free || !liveFmt().lines(lk, pk0)) fullLines(lk, pk0); } else dropCopies(); } }
      else lk.forEach(function (k) {
        var pts = line(k, null, null, pk0);
        if (pts) out.push('<path class="m2-ed-live" stroke-width="' + f1(V.z) + '" d="' + livePath(pts, edges2[k].smooth) + '"/>');
      });
      return pk0;
    }
    // the holders growing round a move (liveC: compartments and complexes) follow their live boxes on the picture, on
    // every format: drawn again at once, not only after the drop. skip: nodes drawn by sizeLive (a node resized by its
    // handles). GraphML and SBGN-ML: each holder's own parts reshaped (liveRec, livePut, as a resize shows a node);
    // CellDesigner: drawn by cdrender's own code (its holders, liveFmt)
    function liveDraw(skip) {
      if (!gN) return;
      if (liveOrig) Object.keys(liveOrig).forEach(function (i) { if (!liveC || !liveC[i]) undraw(+i); });
      if (!liveC) return;
      liveOrig = liveOrig || {};
      skip = skip || [];
      // a holder whose group still carries the keys' shift (its file box already moved, the map not drawn again) is left
      // as it is: drawn at its live box inside that shift it would show moved twice
      var ks = Object.keys(liveC).map(Number).filter(function (i) {
        var n = nodes2[i], g = gN[n.id];
        return g && skip.indexOf(i) < 0 && (n.comp || n.shape.kind === 'Complex') && (liveOrig[i] || !g.getAttribute('transform'));
      });
      if (liveFmt().holders) { liveFmt().holders(ks); return; }
      ks.forEach(function (i) {
        if (!liveOrig[i]) liveOrig[i] = liveRec(i);
        if (liveOrig[i]) livePut(liveOrig[i], liveC[i]);
      });
    }
    var sizeRec = null;   // the node drawn live while it is resized: its parts and how they were
    // a node drawn at another box during a drag, on the picture itself until the renderer draws the map again: a node
    // resized by its handles (sizeLive) and the holders growing round a move (liveDraw) alike. liveRec(i) reads what node
    // i draws: its shape (two for a multimer), its state variables and units of information (kept at their place on its
    // box), its texts (moved with the label's place: a compartment's name stays at its top, a complex's at its bottom);
    // livePut(R, nb) draws it at box nb; liveBack(R) as the renderer drew it
    function liveRec(i) {
      var g = gN && gN[nodes2[i].id];
      if (!g) return null;
      var first = g.firstElementChild && g.firstElementChild.localName === 'a' ? g.firstElementChild : g, b = boxOf(i), seen = new Set();
      var svs = svList(i).map(function (q) {
        var parts = svParts(i, q); parts.forEach(function (el) { seen.add(el); });
        return { parts: parts, r: [(q[1][0] - b[0]) / b[2] - 0.5, (q[1][1] - b[1]) / b[3] - 0.5], c: q[1] };
      });
      var shapes = [], kids = Array.prototype.slice.call(first.children);
      for (var k = 0; k < kids.length && kids[k].localName === 'path' && !seen.has(kids[k]); k++) if (/[Zz]\s*$/.test(kids[k].getAttribute('d') || '')) shapes.push(kids[k]);   // the shape first (two for a multimer); an open path among them (a process's or gate's antenna sticks, drawn first) left as it is
      var R = { i: i, b: b, shapes: shapes, svs: svs, texts: kids.filter(function (el) { return el.localName === 'text' && !seen.has(el); }), was: new Map() };
      shapes.concat(R.texts).forEach(function (el) { R.was.set(el, [el.getAttribute('d'), el.getAttribute('transform')]); });
      svs.forEach(function (s) { s.parts.forEach(function (el) { R.was.set(el, [el.getAttribute('d'), el.getAttribute('transform')]); }); });
      return R;
    }
    function livePut(R, nb) {
      var n = nodes2[R.i], b0 = R.b, two = R.shapes.length > 1 && n.shape.props.mcount === '2';
      // a multimer's back shape first, its fill and its stroke (each outline is two paths)
      R.shapes.forEach(function (el, k) { var o = two && k < R.shapes.length / 2 ? 6 : 0; el.setAttribute('d', outlineD(n.shape, nb[0] + o, nb[1] + o, nb[2], nb[3])); });
      var tr = function (dx, dy) { return 'translate(' + f1(dx) + ' ' + f1(dy) + ')'; };
      var pos = n.labPos || 'c', v = pos.charAt(0);
      var ddx = /l$/.test(pos) ? nb[0] - b0[0] : /r$/.test(pos) ? nb[0] + nb[2] - b0[0] - b0[2] : nb[0] + nb[2] / 2 - b0[0] - b0[2] / 2;
      var ddy = v === 't' ? nb[1] - b0[1] : v === 'b' ? nb[1] + nb[3] - b0[1] - b0[3] : nb[1] + nb[3] / 2 - b0[1] - b0[3] / 2;
      R.texts.forEach(function (el) { el.setAttribute('transform', tr(ddx, ddy)); });
      R.svs.forEach(function (s) {
        var t = tr(nb[0] + (0.5 + s.r[0]) * nb[2] - s.c[0], nb[1] + (0.5 + s.r[1]) * nb[3] - s.c[1]);
        s.parts.forEach(function (el) { el.setAttribute('transform', t); });
      });
    }
    function liveBack(R) {
      if (R.back) { R.back(); return; }   // a CellDesigner holder (its holders, liveFmt)
      R.was.forEach(function (v, el) {
        if (v[0] != null) el.setAttribute('d', v[0]);
        if (v[1] != null) el.setAttribute('transform', v[1]); else el.removeAttribute('transform');
      });
    }
    function sizeLive(i, nb) {   // a format's own drawing where it has one (liveFmt's size: (i, box, record) -> record), else the parts reshaped
      var own = liveFmt().size;
      if (!sizeRec || sizeRec.i !== i) { sizeOff(); sizeRec = own ? own(i, null, null) : liveRec(i); }
      if (sizeRec) { if (own) own(i, nb, sizeRec); else livePut(sizeRec, nb); }
    }
    function sizeOff() {   // the node drawn as the renderer drew it
      if (!sizeRec) return;
      liveBack(sizeRec);
      sizeRec = null;
    }
