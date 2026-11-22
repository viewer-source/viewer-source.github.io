import { shared, V } from './state.js';
import { G, Y, boxOf, doc, docText, edges2, fmt, gE, gN, gridBlock, lastFor, mv, nodes2, num, on, points, pt, realizerOf, warn } from './core.js';
import { bx, dropCopies, restBox, restPt } from './live.js';
import { sbJs } from './sbgn.js';

    // ---------- the GraphML part (editor/src/graphml.js) ----------
    // A yEd GraphML drawn again by the viewer's yEd renderer in JavaScript (renderers/yrender/yrender.js), each node and
    // arc in a group of its own; the shift out of negative places; the compartments' outlines following a drag.

    // the yEd renderer in JavaScript (renderers/yrender/yrender.js): the same SVG as yrender.py byte for byte
    // (tests/yrender-compare.js), so a GraphML map is drawn again with no Python; the editor's way: classes beside the
    // colours and each node and arc in a group of its own (data-n, data-e)
    var yrp;
    function __run1() {   // run at start, in order (__start)
    yrp = null;
    }
    function yr() {
      if (yrp) return yrp;
      yrp = new Promise(function (res, rej) {
        if (window.yrender) return res(window.yrender);
        var s = document.createElement('script');
        s.src = V.renderers + 'yrender/yrender.js' + V.build; s.onload = function () { res(window.yrender); }; s.onerror = function () { rej('renderer not found'); };
        document.head.appendChild(s);
      });
      yrp.catch(function (e) { yrp = null; warn('The renderer did not load: ' + e); });
      return yrp;
    }
    function drawGraphml(t) {   // the document the editor read is drawn when it is still this text (no second reading)
      var A = shared.afSbgn ? afGraphml(t === docText && doc ? doc.cloneNode(true) : new DOMParser().parseFromString(t, 'application/xml')) : null;
      var r = window.yrender.render(A ? A.doc : t === docText && doc ? doc : t, { classes: true, groups: true, sbgn: !!shared.sb });   // sb: an SBGN-ML map (sbgn.js), its glyphs with no fill drawn white
      if (!A) shared.hpMemo = [t, r.ports];   // the processes' ports as drawn, for Turn process and modifier ends (hubPorts); not from the SBGN AF view's changed lines
      if (!A && on) yAhead(t);
      return [A ? afUnits(r.svg, A.units) : r.svg, r.errors];
    }
    // the SBGN view of an Activity Flow map (the palette's AF tab, SBGN view; only on a map with no
    // process, create.js palLookNow): each entity drawn as a biological activity, a sharp-cornered rectangle, with a small
    // unit of information in the entity's shape at its top right: an activity's own unit (the node properties SBGN class
    // and SBGN unit, sbgn_edit), none when it has none (as in SBGN's own AF examples: an activity with no
    // auxiliary unit is a protein activity), another entity's by its kind, none on a protein; a perturbation drawn as
    // itself); its state variables and units of information and a complex's members not drawn (never deleted:
    // the file keeps them, Reduced notation shows them again), a line to a member drawn to its complex. The drawing
    // only: the editor's GraphML and the file stay as they are
    var AF_KINDS;
    function __run2() {   // run at start, in order (__start)
    shared.afSbgn = false;
    AF_KINDS = /^(Macromolecule|SimpleChemical|NucleicAcidFeature|UnspecifiedEntity|Complex)$/;
    }
    function afGraphml(d) {   // d: a document of its own, changed in place
      var units = [], up = {}, keys = {};
      Array.prototype.forEach.call(d.getElementsByTagNameNS(G, 'key'), function (k) { if (k.getAttribute('for') === 'node') keys[k.getAttribute('id')] = k.getAttribute('attr.name'); });
      var prop = function (n, name) { var x = Array.prototype.filter.call(n.childNodes, function (c) { return c.localName === 'data' && keys[c.getAttribute('key')] === name; })[0]; return x ? x.textContent.trim() : null; };
      var uText = {};   // a unit of information's text, by its icon's resource id (an activity's unit drawn with it)
      Array.prototype.forEach.call(d.getElementsByTagNameNS(Y, 'Resource'), function (q) {
        var gn = q.getElementsByTagNameNS(Y, 'GenericNode')[0], l = gn && /UnitOfInformation$/.test(gn.getAttribute('configuration') || '') && gn.getElementsByTagNameNS(Y, 'NodeLabel')[0];
        if (l) uText[q.getAttribute('id')] = l.textContent;
      });
      var ownNode = function (e) { for (var q = e.parentNode; q; q = q.parentNode) if (q.localName === 'node' && q.namespaceURI === G) return q; return null; };
      Array.prototype.slice.call(d.getElementsByTagNameNS(G, 'node')).forEach(function (n) {
        if (up[n.getAttribute('id')]) return;   // a member, cut with its complex's graph
        var rs = ['GenericNode', 'GenericGroupNode'].reduce(function (a, k) { return a.concat(Array.prototype.slice.call(n.getElementsByTagNameNS(Y, k))); }, []).filter(function (r) { return ownNode(r) === n; });
        var kind = null, txt = '';
        rs.forEach(function (r) {
          var k = (r.getAttribute('configuration') || '').replace('com.yworks.sbgn.', '');
          if (!AF_KINDS.test(k)) return;
          kind = kind || k;
          r.setAttribute('configuration', 'com.yworks.sbgn.Macromolecule');
          Array.prototype.slice.call(r.getElementsByTagNameNS(Y, 'StyleProperties')).forEach(function (x) { x.parentNode.removeChild(x); });
          var sp = d.createElementNS(Y, 'y:StyleProperties'), pr = d.createElementNS(Y, 'y:Property');
          pr.setAttribute('class', 'java.lang.Integer'); pr.setAttribute('name', 'com.yworks.sbgn.style.radius'); pr.setAttribute('value', '0');
          sp.appendChild(pr); r.appendChild(sp);
          Array.prototype.slice.call(r.getElementsByTagNameNS(Y, 'NodeLabel')).forEach(function (l) { var q = l.getAttribute('iconData'); if (!q) return; if (!txt && uText[q]) txt = uText[q]; l.parentNode.removeChild(l); });
        });
        if (!kind) return;
        var r0 = realizerOf(n) || rs[0], g = r0.getElementsByTagNameNS(Y, 'Geometry')[0];   // the active realizer's box (a closed complex's other one)
        var act = prop(n, 'SBGN class') === 'biological activity';
        units.push([n.getAttribute('id'), act ? prop(n, 'SBGN unit') || '' : sbJs.unitFor(kind) || '', +g.getAttribute('x'), +g.getAttribute('y'), +g.getAttribute('width'), +g.getAttribute('height'), act ? txt.trim() : '']);
        Array.prototype.slice.call(n.childNodes).forEach(function (c) {   // a complex's members: not drawn, their lines to it
          if (c.localName !== 'graph') return;
          var names = [];
          Array.prototype.forEach.call(c.getElementsByTagNameNS(G, 'node'), function (m) {
            up[m.getAttribute('id')] = n.getAttribute('id');
            var ml = Array.prototype.filter.call(m.getElementsByTagNameNS(Y, 'NodeLabel'), function (l) { return !l.getAttribute('iconData') && l.textContent.trim(); })[0];
            if (ml && !m.getElementsByTagNameNS(G, 'graph').length) names.push(ml.textContent.trim());
          });
          n.removeChild(c);
          // an unnamed complex named by its members, as MINERVA and CellDesigner name one (A:B), centred as an activity's name
          rs.forEach(function (r) {
            var l = Array.prototype.filter.call(r.getElementsByTagNameNS(Y, 'NodeLabel'), function (x) { return !x.getAttribute('iconData'); })[0];
            if (!l) return;
            if (!l.textContent.trim() && names.length) { while (l.firstChild) l.removeChild(l.firstChild); l.appendChild(d.createTextNode(names.join(':'))); l.setAttribute('hasText', 'true'); }
            l.setAttribute('modelName', 'internal'); l.setAttribute('modelPosition', 'c');
          });
        });
      });
      Array.prototype.slice.call(d.getElementsByTagNameNS(G, 'edge')).forEach(function (e) {
        var p = e.getElementsByTagNameNS(Y, 'Path')[0];
        if (up[e.getAttribute('source')] && up[e.getAttribute('source')] === up[e.getAttribute('target')]) { e.parentNode.removeChild(e); return; }   // between two members of one complex: inside it
        [['source', 'sx', 'sy'], ['target', 'tx', 'ty']].forEach(function (q) {
          var to = up[e.getAttribute(q[0])];
          if (!to) return;
          e.setAttribute(q[0], to);
          if (p) { p.setAttribute(q[1], '0.0'); p.setAttribute(q[2], '0.0'); }
        });
      });
      return { doc: d, units: units };
    }
    function afUnits(svg, units) {   // each activity's unit of information, last in its node's group so it lies over the top edge
      var esc = function (x) { return x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;'); };   // as yrender's esc
      var byId = {};
      units.forEach(function (u) {
        // small, at the top right, twice as wide as high for a protein, square
        // for a metabolite: its box sbgn_edit's afUnitBox, the one the file is given, wider for its text (free
        // text allowed, ct:gene and ct:mRNA), the text centred in it
        var B = sbJs.afUnitBox(u.slice(2, 6), u[1], u[6]);
        if (!B) return;   // none: a protein's activity
        var x = B[0], y = B[1], w = B[2], h = B[3], c = h * 0.3, m = y + h / 2, f = function (v) { return Math.round(v * 100) / 100; }, k = sbJs.unitClass(u[1]), D;
        if (k === 'macromolecule') D = 'M' + f(x + c) + ' ' + f(y) + 'H' + f(x + w - c) + 'Q' + f(x + w) + ' ' + f(y) + ' ' + f(x + w) + ' ' + f(y + c) + 'V' + f(y + h - c) + 'Q' + f(x + w) + ' ' + f(y + h) + ' ' + f(x + w - c) + ' ' + f(y + h) +
          'H' + f(x + c) + 'Q' + f(x) + ' ' + f(y + h) + ' ' + f(x) + ' ' + f(y + h - c) + 'V' + f(y + c) + 'Q' + f(x) + ' ' + f(y) + ' ' + f(x + c) + ' ' + f(y) + 'Z';   // rounded corners, as the protein's own
        else if (k === 'nucleic acid feature') D = 'M' + f(x) + ' ' + f(y) + 'H' + f(x + w) + 'V' + f(y + h - c) + 'Q' + f(x + w) + ' ' + f(y + h) + ' ' + f(x + w - c) + ' ' + f(y + h) + 'H' + f(x + c) + 'Q' + f(x) + ' ' + f(y + h) + ' ' + f(x) + ' ' + f(y + h - c) + 'Z';
        else if (k === 'complex') D = 'M' + f(x + c) + ' ' + f(y) + 'H' + f(x + w - c) + 'L' + f(x + w) + ' ' + f(y + c) + 'V' + f(y + h - c) + 'L' + f(x + w - c) + ' ' + f(y + h) + 'H' + f(x + c) + 'L' + f(x) + ' ' + f(y + h - c) + 'V' + f(y + c) + 'Z';
        else if (k === 'phenotype') D = 'M' + f(x) + ' ' + f(y) + 'H' + f(x + w) + 'L' + f(x + w - c) + ' ' + f(m) + 'L' + f(x + w) + ' ' + f(y + h) + 'H' + f(x) + 'L' + f(x + c) + ' ' + f(m) + 'Z';   // a perturbation's unit, the perturbing agent's shape
        else D = 'M' + f(x) + ' ' + f(m) + 'A' + f(w / 2) + ' ' + f(h / 2) + ' 0 1 0 ' + f(x + w) + ' ' + f(m) + 'A' + f(w / 2) + ' ' + f(h / 2) + ' 0 1 0 ' + f(x) + ' ' + f(m) + 'Z';   // a simple chemical's circle, an unspecified entity's ellipse
        var fs = sbJs.afUnitFont(h), T = u[6] ? '<text class="m2-af-ut" x="' + f(x + w / 2) + '" y="' + f(m) + '" font-family="Arial, Helvetica, sans-serif" font-size="' + f(fs) + '" text-anchor="middle" dominant-baseline="central" fill="#000000">' + esc(u[6].replace(/\s*\n\s*/g, ' ')) + '</text>' : '';
        byId[esc(u[0])] = '<path d="' + D + '" fill="white" class="c-white" stroke="#000000"/>' + T;
      });
      // one pass over the drawing: each node group's own closing tag takes its unit
      var out = [], at = 0, stack = [], re = /<g data-n="([^"]*)">|<g[\s>]|<\/g>/g, mt;
      while ((mt = re.exec(svg))) {
        if (mt[0] === '</g>') { var id = stack.pop(); if (id && byId[id]) { out.push(svg.slice(at, mt.index), byId[id]); at = mt.index; } }
        else stack.push(mt[1] || null);
      }
      out.push(svg.slice(at));
      return out.join('');
    }
    // the live drawing of a move on a map the yEd renderer draws (GraphML, SBGN-ML): the arcs it touches, and the
    // processes and gates whose antennas turn with every arc at them, drawn by the renderer itself as the drop will
    // draw them (yrender.live: the map of the drawing on screen read once, then the boxes, bend points and ports of what
    // moves given each frame against it: a drag, and the arrow keys, which write their steps into the text ahead of the
    // drawing), so a line leaves a process from the port it will have; false (fullLines' copies) for the SBGN view of
    // an Activity Flow map, an end over another node, or anything the renderer cannot draw
    var yLive, liveY;
    function __run3() {   // run at start, in order (__start)
    yLive = null;
    liveY = { glyphs: function () {}, lines: yLines, holders: null };
    }
    function svgEl(svg) {   // a group of the renderer's drawing as an element of this page
      var g = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' + svg + '</svg>', 'image/svg+xml').documentElement.firstElementChild;
      if (!g) return null;
      g = document.importNode(g, true);
      g.removeAttribute('data-e'); g.removeAttribute('data-n'); g.classList.add('m2-ed-copy');
      return g;
    }
    function ySession(t) {   // the renderer's live session of text t, kept until another text is drawn
      if (yLive && yLive.t === t) return yLive;
      var ix = {};
      edges2.forEach(function (e, k) { ix[e.id] = k; });
      yLive = { t: t, ix: ix, s: window.yrender.live(t === docText && doc ? doc : t, { classes: true, sbgn: !!shared.sb }) };
      return yLive;
    }
    function yAhead(t) {   // made while the browser is idle after a drawing, so the next drag starts at once (0.2 s on the largest map)
      var go = function () { try { if (on && !mv && !shared.keyed && window.yrender && window.yrender.live && t === shared.text) ySession(t); } catch (x) {} };
      if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 2000 }); else setTimeout(go, 300);
    }
    function yLines(ks, pp) {
      if (!gE || shared.afSbgn || !lastFor || lastFor[3] || !window.yrender || !window.yrender.live || (pp && pp.n2 != null)) return false;
      var t = lastFor[0], out;   // the text of the drawing on screen
      try {
        if (!ySession(t).s) return false;
        var boxes = {}, paths = {}, moved = new Set();
        nodes2.forEach(function (n, i) { var a = bx(i), b = restBox(i); if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) { boxes[n.id] = a; moved.add(i); } });
        // every arc with an end or a bend point moving, its points as they are now (an arc whose two ends move is
        // shifted whole, but may be drawn again with a process at it)
        edges2.forEach(function (e, k) {
          var pts = e.pts.map(pt), mine = pp && pp.to && pp.k === k;
          if (!mine && !ks.has(k)) {
            if (!moved.has(e.s) && !moved.has(e.t) && !e.pts.some(function (pi, j) { var r = restPt(pi); return r[0] !== pts[j][0] || r[1] !== pts[j][1]; })) return;
          }
          var q = ['sx', 'sy', 'tx', 'ty'].map(function (a) { return e.path ? parseFloat(e.path.getAttribute(a)) || 0 : 0; });
          if (mine) { var j = pp.end ? 2 : 0; q[j] = pp.to[0]; q[j + 1] = pp.to[1]; }
          paths[e.id] = { pts: pts, port: q };
        });
        out = yLive.s.draw(boxes, paths, Array.from(ks, function (k) { return edges2[k].id; }));
      } catch (x) { out = null; }
      if (!out) return false;
      dropCopies();
      Object.keys(out.n).forEach(function (id) {
        var g = gN[id], c = svgEl(out.n[id]), tr = g && (g.getAttribute('transform') || '').match(/translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/);
        if (!g || !c) return;
        if (!tr) { g.style.display = 'none'; g.parentNode.insertBefore(c, g.nextSibling); shared.copies.push([c, g, null]); return; }
        // one that moves itself: its group is shifted and holds the selection's fill, so its drawing is swapped inside
        // it, the shift taken back
        c.setAttribute('transform', 'translate(' + -tr[1] + ' ' + -tr[2] + ')');
        Array.prototype.forEach.call(g.children, function (x) { x.style.display = 'none'; shared.copies.push([document.createComment(''), x, null]); });
        g.insertBefore(c, g.firstChild); shared.copies.push([c, null, null]);
      });
      Object.keys(out.e).forEach(function (id) {
        var gs = gE[id], c = svgEl(out.e[id]);
        if (!gs || !c) return;
        gs.forEach(function (g, j) { g.style.display = 'none'; if (j) shared.copies.push([document.createComment(''), g, yLive.ix[id]]); });
        gs[0].parentNode.insertBefore(c, gs[0].nextSibling); shared.copies.push([c, gs[0], yLive.ix[id]]);
      });
      return true;
    }
    // no negative places (negative coordinates are invalid in CellDesigner, so corrected in every format):
    // a map moved past the left or the top edge is shifted right or down, each on its own, by whole blocks of the grid
    // (gridBlock, 16 on a grid of 8, so a map on the grid stays on it) to start at 40 or a little more; the drawing stays where it is on screen
    // (the renderer's frame follows). A GraphML here; a CellDesigner file in cd_edit.place
    // the same shift worked out ahead from a document alone (read ahead while the map is shown): the text it gives,
    // or the text itself when nothing moves; were it ever to differ from noNegative's, the drawing made ahead is simply
    // not used (it is kept with its text), so this can only cost time, never change a map
    function shiftedAhead(t, d) {
      var mx = Infinity, my = Infinity, re = /<y:(?:Geometry|Point)\s[^>]*>/g;
      var owner = function (e) { for (var p = e.parentNode; p; p = p.parentNode) if (p.localName === 'node' && p.namespaceURI === G) return p; return null; };
      var own = new Map();
      Array.prototype.forEach.call(d.getElementsByTagNameNS(Y, 'Geometry'), function (g) { var n = owner(g); if (n && !own.has(n)) own.set(n, g); });
      own.forEach(function (g0, n) {
        var r = realizerOf(n), g = r && r.getElementsByTagNameNS(Y, 'Geometry')[0];
        if (!g) g = g0;   // as parse(): the realizer's first geometry, else the node's first
        mx = Math.min(mx, num(g, 'x')); my = Math.min(my, num(g, 'y'));
      });
      Array.prototype.forEach.call(d.getElementsByTagNameNS(Y, 'Point'), function (p) { mx = Math.min(mx, num(p, 'x')); my = Math.min(my, num(p, 'y')); });
      var B = gridBlock(), block = function (m) { return m < 0 ? Math.ceil((40 - m) / B) * B : 0; }, sx = block(mx), sy = block(my);
      if (!sx && !sy) return t;
      return t.replace(re, function (tag) { return shiftTag(tag, sx, sy); });
    }
    function shiftTag(tag, sx, sy) {   // only the axis shifted is written (an SBGN-ML map's other numbers stay as they are)
      if (sx) tag = tag.replace(/(\sx=")([^"]*)"/, function (a, k, v) { return k + fmt(parseFloat(v) + sx) + '"'; });
      if (sy) tag = tag.replace(/(\sy=")([^"]*)"/, function (a, k, v) { return k + fmt(parseFloat(v) + sy) + '"'; });
      return tag;
    }
    function noNegative() {
      // what is drawn counts (a closed group's other size, kept by yEd, does not), all of it moves
      var mx = Infinity, my = Infinity, re = /<y:(?:Geometry|Point)\s[^>]*>/g;
      nodes2.forEach(function (n, i) { var b = boxOf(i); mx = Math.min(mx, b[0]); my = Math.min(my, b[1]); });
      points.forEach(function (p) { mx = Math.min(mx, num(p, 'x')); my = Math.min(my, num(p, 'y')); });
      var B = gridBlock(), block = function (m) { return m < 0 ? Math.ceil((40 - m) / B) * B : 0; }, sx = block(mx), sy = block(my);
      if (!sx && !sy) return null;
      shared.text = shared.text.replace(re, function (tag) { return shiftTag(tag, sx, sy); });
      return [sx, sy];
    }

    export function __start() { __run1(); __run2(); __run3(); }   // the part's statements, in their order
    export { AF_KINDS, drawGraphml, liveY, noNegative, shiftedAhead, yr };
