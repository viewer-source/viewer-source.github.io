// holding: what holds what on a map the editor changes, as pure functions of a model of the map. The one master of the
// rules (regrouping, growing a holder round a member, a complex resized round its members, the holder a box lies in);
// the editor calls it, and a tool or an agent that edits part of a map calls the same functions under Node, so
// membership is kept as a person's edit keeps it. It imports nothing, reads no page and writes nothing: each function
// gives its answer, and the caller writes it (sbgn_edit.moveInto for a new holder, graphml_edit.boxes for a box).
//   inBox(b, c), overlap(b, c): two boxes [x, y, w, h].
//   make(M) -> { inBox, overlap, under, notIn, inComplex, holder, tops, regroup, grown, drawnOut, cxRoom, roomy, keepMembers, placed }, the
//     functions bound to model M:
//     M.nodes: the map's nodes, as the editor reads them from its GraphML: { id, up (the index of the node holding it,
//       or null), kids (the indexes it holds directly), comp (a compartment), hub (a process or a logic gate),
//       shape.kind ('Complex' for a complex), lab { t, b } (its own labels inside, at the top and the bottom),
//       ins [left, top, right, bottom] (its Insets) }
//     M.box(k): node k's box now, [x, y, w, h]
//     M.ext(k, b): what node k draws round box b (labels, units of information, a multimer's second outline),
//       [x0, y0, x1, y1]; absent: the box itself
//     M.cd: a CellDesigner map (a compartment's double border inside its box; a CellDesigner process glyph or gate, an
//       id holding '|', placed by cd_edit and never regrouped here)
//     M.pad: an inside member's least space to its compartment's inner line (the editor's Compartments padding)
//     M.cx: a complex's padding, a number on every side or 'repack': M.room's sides (what Pack leaves round members)
//   settle(M, change) -> { moves: [[id, new holder id or null]], boxes: { id: [x, y, w, h] } }: the whole answer to one
//     change in one call, for a tool: the new holders (regroup) and the holders grown round what changed (grown), the
//     growing worked out on the map with the new holders applied. change: { how, ids, before, away, layout }:
//     how: 'plain' (moved with what they hold), 'alone' (moved by themselves, as with Shift) or 'box' (resized or made);
//     ids: every node whose box changed, what a moved node holds included (a holder grows round what did not move with
//       it, so contents left out would count as staying behind);
//     before: { id: box }, every node's box before (M.box gives the boxes now); away: a drag's furthest moves, optional;
//     layout: true for Layout editing (what holds what never changes there; the holders only grow).
//     A resized compartment in Full editing regroups and grows nothing; a resized complex, or a resize in Layout
//     editing, keeps its holders and grows them round it. Not decided here: a glyph dropped on a complex joining it
//     (the format's rules, the editor's joinPlan) and a CellDesigner member leaving its complex (cd_make.leave).
//     The editor calls regroup and grown on each side of its writing (core.js settle); tests/membership.js checks that
//     settle gives what that path gives, and tests/holding-live.js that the editor gives what settle gives.
(function (root) {
  'use strict';
  function inBox(b, c) { return c[0] <= b[0] && c[1] <= b[1] && b[0] + b[2] <= c[0] + c[2] && b[1] + b[3] <= c[1] + c[3]; }   // box b fully in box c, as cd_edit's inside()
  function overlap(b, c) { return b[0] < c[0] + c[2] && c[0] < b[0] + b[2] && b[1] < c[1] + c[3] && c[1] < b[1] + b[3]; }
  function make(M) {
    var nodes = M.nodes, boxOf = M.box;
    var extOf = function (k, b) { return M.ext ? M.ext(k, b) : [b[0], b[1], b[0] + b[2], b[1] + b[3]]; };
    function under(i, a) { for (var u = nodes[i].up; u != null; u = nodes[u].up) if (u === a) return true; return false; }   // a holds i, at any depth
    function notIn(i) { return function (k) { return k === i || under(k, i); }; }   // neither the node nor what it holds
    function inComplex(i) { for (var u = nodes[i].up; u != null; u = nodes[u].up) if (nodes[u].shape.kind === 'Complex') return true; return false; }
    function cdOwn(i) { return !!M.cd && nodes[i].id.indexOf('|') >= 0; }   // a CellDesigner process glyph or gate
    function holder(b, not, B) {   // the innermost compartment whose box holds box b fully, none for which not() holds
      var best = null, area = Infinity;
      B = B || boxOf;
      nodes.forEach(function (n, k) { if (!n.comp || not(k)) return; var c = B(k); if (inBox(b, c) && c[2] * c[3] < area) { area = c[2] * c[3]; best = k; } });
      return best;
    }
    function tops(set, alone) {   // the nodes a move grows round: those not moving with their holder; with Shift only compartments (rule 2)
      return Array.from(set).filter(function (i) { return !cdOwn(i) && (alone ? nodes[i].comp : !(nodes[i].up != null && set.has(nodes[i].up))); });
    }
    function cxRoom(n) {   // [left, top, right, bottom] from complex n's members (what they draw) to its box
      var p = M.cx, R = M.room;
      if (p === 'repack' && R) return [R.left, R.top + n.lab.t, R.right, n.lab.b ? R.named + n.lab.b : R.bottom];
      if (p === 'repack') p = 12;
      return [p, p + n.lab.t, p, p + n.lab.b];
    }
    // the holders grown round a change of places: node -> its new box. ks: the nodes moved (tops) or the one resized; B:
    // the boxes now, B0: before; moving(k): k moves with them. Measured by what each node draws round its box (extOf). A
    // complex grows to hold its member with its padding and labels (cxRoom); a compartment to keep PAD from its inner
    // line round an inside member (as close as it was, where it was closer), an edge member crossing its border by one
    // unit, or, moved with another compartment drawn outside it there (drawnOut), its box's centre one unit inside (as
    // far out as it was where it started out), nothing for one already fully outside; what grows grows its own holder in
    // turn the same way; never smaller. away: a drag's furthest moves so far ({ x0, x1, y0, y1 }, the least and most dx
    // and dy); a moving member whose room on a side reached the padding during the drag (moved away from a closer place)
    // takes the padding there again, the closer room it started with dropped
    function grown(ks, B, B0, moving, away) {
      var nb = {}, box = function (k) { return nb[k] || B(k); }, PAD = M.pad;
      var hold = function (k) {
        var p = nodes[k].up;
        if (p == null || moving(p)) return;
        var n = nodes[p], c = box(p), b = box(k), w, e = extOf(k, b);
        var s0 = B0(k), c0 = B0(p), e0 = extOf(k, s0);
        var far = away && moving(k) ? [away.x1, away.y1, -away.x0, -away.y0] : [0, 0, 0, 0];   // how far it went from each side
        if (n.shape.kind === 'Complex') {   // its padding, as close as the member was where it was closer (as a compartment's)
          var g0 = [e0[0] - c0[0], e0[1] - c0[1], c0[0] + c0[2] - e0[2], c0[1] + c0[3] - e0[3]];
          var rm = cxRoom(n).map(function (v, j) { return g0[j] + far[j] >= v ? v : Math.min(v, Math.max(g0[j], 0)); });
          w = [e[0] - rm[0], e[1] - rm[1], e[2] + rm[2], e[3] + rm[3]];
        }
        else if (inBox(s0, c0)) {   // inside: PAD from its inner line (as close as it was, where it already was closer: another tool's file)
          var io = [M.cd ? n.ins[0] : 0, (M.cd ? n.ins[1] : 0) + n.lab.t, M.cd ? n.ins[2] : 0, (M.cd ? n.ins[3] : 0) + n.lab.b];
          var pad = [e0[0] - c0[0], e0[1] - c0[1], c0[0] + c0[2] - e0[2], c0[1] + c0[3] - e0[3]].map(function (v, j) { return (v - io[j] + far[j] >= PAD ? PAD : Math.min(PAD, v - io[j])) + io[j]; });
          w = [e[0] - pad[0], e[1] - pad[1], e[2] + pad[2], e[3] + pad[3]];
        } else if (overlap(s0, c0) && moving(k) && !nodes[k].comp && drawnOut(k, p, s0, c0, B0)) {   // dragged on the edge, another compartment drawn outside it there: its centre kept inside
          var m0 = [s0[0] + s0[2] / 2 - c0[0], s0[1] + s0[3] / 2 - c0[1], c0[0] + c0[2] - s0[0] - s0[2] / 2, c0[1] + c0[3] - s0[1] - s0[3] / 2]
            .map(function (v, j) { return v + far[j] >= 1 ? 1 : v; });   // one unit inside; where it started further out (another tool's file), as far out as it was
          var cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
          w = [cx - m0[0], cy - m0[1], cx + m0[2], cy + m0[3]];
        } else if (overlap(s0, c0)) w = [b[0] + b[2] - 1, b[1] + b[3] - 1, b[0] + 1, b[1] + 1];   // on the edge against empty space: kept crossing it
        else return;   // fully outside already (another tool's file): as it is
        var x0 = Math.min(c[0], w[0]), y0 = Math.min(c[1], w[1]), x1 = Math.max(c[0] + c[2], w[2]), y1 = Math.max(c[1] + c[3], w[3]);
        if (Math.abs(x0 - c[0]) < 0.01 && Math.abs(y0 - c[1]) < 0.01 && Math.abs(x1 - c[0] - c[2]) < 0.01 && Math.abs(y1 - c[1] - c[3]) < 0.01) return;
        nb[p] = [x0, y0, x1 - x0, y1 - y0];
        hold(p);
      };
      ks.forEach(hold);
      return nb;
    }
    // edge member k of compartment p (boxes s0, c0 at the drag's start, B0) has another compartment drawn outside p where
    // it sits: one that covers some of k's box outside p (a neighbour, or p's holder, as round a nucleus), not one inside p
    // or k. Read from the start's boxes, so the answer holds until release
    function drawnOut(k, p, s0, c0, B0) {
      return nodes.some(function (q, j) {
        if (!q.comp || j === p || j === k || under(j, p) || under(j, k)) return false;
        var d = B0(j), x0 = Math.max(s0[0], d[0]), y0 = Math.max(s0[1], d[1]), x1 = Math.min(s0[0] + s0[2], d[0] + d[2]), y1 = Math.min(s0[1] + s0[3], d[1] + d[3]);
        return x1 > x0 && y1 > y0 && !inBox([x0, y0, x1 - x0, y1 - y0], c0);
      });
    }
    // the new holders after a change of places (Full editing only), node -> its new parent (null: the map itself), only
    // where it changes. how: 'plain' (set: the nodes moved with what they hold), 'alone' (set: the nodes moved by
    // themselves), 'box' (set: a compartment resized or made); B: the boxes now, B0: before the change
    function regroup(how, set, B, B0) {
      B = B || boxOf; B0 = B0 || boxOf;
      var out = new Map(), fixed = function (k) { return nodes[k].hub || cdOwn(k); }, changed = [];
      var away = function (k, b, not) {   // where node k goes once it leaves its holder
        if (!fixed(k)) return holder(b, not, B);
        for (var u = nodes[k].up; u != null; u = nodes[u].up) if (nodes[u].comp && !not(u) && inBox(b, B(u))) return u;   // a process or gate: a compartment already round it
        return null;
      };
      set.forEach(function (i) {
        var n = nodes[i], p = n.up, b = B(i);
        if (cdOwn(i) || (how === 'plain' && ((p != null && set.has(p)) || inComplex(i)))) return;   // with its holder; a plain drag keeps a complex's members
        if (n.comp || (how === 'alone' && n.kids.length)) changed.push(i);   // its box changed by itself, or it moved
        var not = how === 'plain' ? function (k) { return set.has(k); } : notIn(i), t;
        if (p != null && how === 'alone' && nodes[p].shape.kind === 'Complex') { if (!inBox(b, B(p))) out.set(i, away(i, b, not)); return; }   // out of its complex once not fully inside
        if (p != null && (how === 'plain' ? true : how === 'alone' ? overlap(b, B(p)) : inBox(b, B(p)))) {   // stays: only into a compartment it newly lies fully in, deeper inside
          t = holder(b, not, B);
          if (t == null || t === p || !under(t, p) || fixed(i) || inBox(B0(i), B0(t))) return;
        } else if (p == null) {
          t = holder(b, not, B);
          if (t == null || fixed(i) || (how === 'box' && inBox(B0(i), B0(t)))) return;
        } else t = away(i, b, not);   // fully out with Shift; a compartment resized past its holder's edge
        if (t !== p) out.set(i, t);
      });
      changed.forEach(function (i) {
        var n = nodes[i], b = B(i), b0 = B0(i);
        if (how !== 'plain') n.kids.forEach(function (k) {   // what no longer overlaps it (a complex: no longer fully inside)
          if (set.has(k) || out.has(k)) return;
          var kb = B(k);
          if (n.comp ? !overlap(kb, b) && overlap(kb, b0) : !inBox(kb, b) && inBox(kb, b0)) out.set(k, away(k, kb, notIn(k)));
        });
        if (!n.comp) return;
        var nu = out.has(i) ? out.get(i) : n.up;   // its holder after the change: neither it nor those round it are taken in
        nodes.forEach(function (m, j) {   // what it newly covers, with what is inside; one that held it too, once it has left it
          if (j === i || set.has(j) || out.has(j) || fixed(j) || inComplex(j) || under(j, i) || j === nu || (nu != null && under(nu, j))) return;
          var jb = B(j);
          if (!inBox(jb, b) || inBox(jb, b0)) return;
          var t = holder(jb, function (k) { return k !== i && (k === j || under(k, j)); }, B);
          if (t !== m.up && (t === i || (t != null && under(t, i)))) out.set(j, t);
        });
      });
      return out;
    }
    // a complex resized by its handles: the sides dragged (s) held where its members still fit, with its padding and
    // labels as grown() holds a member, never further out than where they started (b0: members closer than the Insets in
    // another tool's file keep their room); the members stay where they are
    function roomy(i, b, s, b0) {
      var n = nodes[i], x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      var rm = cxRoom(n);
      n.kids.forEach(function (k) { var e = extOf(k, boxOf(k)); x0 = Math.min(x0, e[0] - rm[0]); y0 = Math.min(y0, e[1] - rm[1]); x1 = Math.max(x1, e[2] + rm[2]); y1 = Math.max(y1, e[3] + rm[3]); });
      if (x0 === Infinity) return b;
      var L = b[0], T = b[1], R = b[0] + b[2], B = b[1] + b[3];
      if (/l/.test(s)) L = Math.min(L, Math.max(x0, b0[0])); if (/r/.test(s)) R = Math.max(R, Math.min(x1, b0[0] + b0[2]));
      if (/t/.test(s)) T = Math.min(T, Math.max(y0, b0[1])); if (/b/.test(s)) B = Math.max(B, Math.min(y1, b0[1] + b0[3]));
      return [L, T, R - L, B - T];
    }
    // a compartment i resized in Layout editing (what holds what never changes there): its sides [x0, y0, x1, y1] held
    // where every member that overlapped its box b0 still overlaps it by one unit
    function keepMembers(i, b0, e) {
      var x0 = e[0], y0 = e[1], x1 = e[2], y1 = e[3];
      nodes[i].kids.forEach(function (k) {
        var q = boxOf(k);
        if (!overlap(q, b0)) return;
        x0 = Math.min(x0, q[0] + q[2] - 1); y0 = Math.min(y0, q[1] + q[3] - 1); x1 = Math.max(x1, q[0] + 1); y1 = Math.max(y1, q[1] + 1);
      });
      return [x0, y0, x1, y1];
    }
    return { placed: cdOwn, keepMembers: keepMembers, inBox: inBox, overlap: overlap, under: under, notIn: notIn, inComplex: inComplex, holder: holder, tops: tops,
             regroup: regroup, grown: grown, drawnOut: drawnOut, cxRoom: cxRoom, roomy: roomy };
  }

  // the model after new holders: up and kids changed for moves ([[index, new holder index or null]]), every other field
  // read through M's nodes as it was (inside, the order of kids: not as a map read again would give them); nothing in M
  // is changed
  function moved(M, moves) {
    var up = M.nodes.map(function (n) { return n.up; });
    moves.forEach(function (m) { up[m[0]] = m[1]; });
    var kids = M.nodes.map(function () { return []; });
    M.nodes.forEach(function (n, k) { var keep = n.kids.filter(function (c) { return up[c] === k; }); kids[k] = keep; });
    moves.forEach(function (m) { if (m[1] != null && kids[m[1]].indexOf(m[0]) < 0) kids[m[1]].push(m[0]); });
    var nodes = M.nodes.map(function (n, k) { var o = Object.create(n); o.up = up[k]; o.kids = kids[k]; return o; });
    var M2 = {}; Object.keys(M).forEach(function (key) { M2[key] = M[key]; }); M2.nodes = nodes;
    return M2;
  }
  function settle(M, change) {
    var at = {}; M.nodes.forEach(function (n, k) { at[n.id] = k; });
    var set = new Set(change.ids.map(function (id) { return at[id]; }).filter(function (k) { return k != null; }));
    var B0 = function (k) { return (change.before && change.before[M.nodes[k].id]) || M.box(k); };
    // a box changed: a compartment in Full editing regroups and grows nothing; a complex, or anything in Layout editing,
    // keeps its holders and grows them round its new box (core.js holderSize)
    var box = change.how === 'box', regroups = !change.layout && (!box || Array.from(set).every(function (k) { return M.nodes[k].comp; }));
    var H = make(M), out = regroups ? H.regroup(change.how, set, M.box, B0) : new Map(), mv = [];
    out.forEach(function (t, i) { mv.push([i, t]); });
    var M2 = moved(M, mv), H2 = make(M2), boxes = {};
    var nb = box ? (regroups ? {} : H2.grown(Array.from(set), M.box, B0, function () { return false; }))
      : H2.grown(H2.tops(set, change.how === 'alone'), M.box, B0, function (k) { return set.has(k); }, change.away);
    Object.keys(nb).forEach(function (k) { boxes[M.nodes[+k].id] = nb[k]; });
    return { moves: mv.map(function (m) { return [M.nodes[m[0]].id, m[1] == null ? null : M.nodes[m[1]].id]; }), boxes: boxes };
  }

  var api = { inBox: inBox, overlap: overlap, make: make, moved: moved, settle: settle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.holding = api;
})(typeof self !== 'undefined' ? self : this);
