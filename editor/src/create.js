    // ---------- making new things: the palette (editor/src/create.js) ----------
    // The full editor (user, 2026-11-14): entities taken from a palette in the Edit window, as in yEd and Newt. A click on
    // a sign takes it for one use: the next click on the map puts it there and the sign lets go; a double click keeps it
    // in hand for several in a row, until a click on the sign again or Esc (user: "this tool stick to your hand"); a sign
    // dragged onto the map is put where it is dropped. The pointer stays the plain arrow. Only with Settings, Editing on
    // Full, and for now only on SBGN-ML maps: sbgn_edit (renderers/converter/sbgn_edit.js, its master, tested against the
    // converter by tests/sbgn-create.js) writes what is made into the editor's GraphML as the converter writes it, and
    // into the SBGN-ML file. So far: a macromolecule, its name, its state variables (added from the right-click menu over
    // a macromolecule, user: "Auxiliary units - remove this section, to be added via right click"), its units of
    // information (free text, user: "they should know notation and they should type it themselves"), a multimer or a
    // single macromolecule again (right-click Make multimer, Make macromolecule), and deleting them; a simple chemical,
    // 40 by 40 at the map's scale, with its name only (user, 2026-11-14: no state variable or unit of information on it
    // for now, though SBGN allows them: CellDesigner keeps none, and they are rarely welcome there).
    // Nothing asks for a name when made (user: "I will name when I want to name"): a double click on a named entity or a
    // state variable, or a click on a state variable already selected, opens its text in place, in the glyph's own
    // colours and font (user: "simply make it editable for the text"); Enter or a click elsewhere keeps it, Esc not.
    var PAL = [
      ['Entity pool nodes', [['macromolecule', 'Macromolecule', '<rect x="2.5" y="6.5" width="19" height="11" rx="3"/>'],
        ['simple chemical', 'Simple chemical', '<circle cx="12" cy="12" r="7"/>']]]
    ];
    var tool = null;   // { kind, sticky } in hand
    var pal = document.createElement('div');
    pal.className = 'm2-ed-palette'; pal.hidden = true; pal.setAttribute('role', 'toolbar'); pal.setAttribute('aria-label', 'Palette');
    pal.innerHTML = PAL.map(function (s) {
      return '<p>' + s[0] + '</p><div class="m2-ed-prow">' + s[1].map(function (q) {
        return '<button type="button" data-make="' + q[0] + '" title="' + q[1] + ' (click: once; double click: several)" aria-label="' + q[1] + '" aria-pressed="false">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' + q[2] + '</svg></button>';
      }).join('') + '</div>';
    }).join('');
    box.querySelector('.m2-ed-tools').insertAdjacentElement('afterend', pal);
    function palOn() { return on && V.current === map && !!sb && !!sbJs && V.level === 'full'; }
    function palShow() {
      var show = palOn();
      pal.hidden = !show;
      if (!show) tool = null;
      Array.prototype.forEach.call(pal.querySelectorAll('button'), function (b) {
        var mine = !!tool && tool.kind === b.dataset.make;
        b.setAttribute('aria-pressed', String(mine));
        b.classList.toggle('m2-ed-sticky', mine && tool.sticky);
      });
      if (!tool && V.view.style.cursor === 'default') V.view.style.cursor = '';
    }
    function palTake(kind, sticky) { tool = kind ? { kind: kind, sticky: !!sticky } : null; palShow(); }
    pal.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-make]');
      if (!b) return;
      palTake(tool && tool.kind === b.dataset.make ? null : b.dataset.make, false);   // a second click lets go
    });
    pal.addEventListener('dblclick', function (e) {
      var b = e.target.closest('button[data-make]');
      if (b) palTake(b.dataset.make, true);
    });
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#m2-set-edit')) setTimeout(palShow, 0); }, true);   // Settings, Editing changed
    document.addEventListener('keydown', function (e) { if (tool && e.key === 'Escape') palTake(null); }, true);

    // the map clicked with something in hand: a press only noted, so a drag still moves the map; the click is taken on release
    var placeAt = null, placedAt = 0;   // placedAt: when something was last put on the map (a double click there is not a second request)
    function palDown(e) {
      if (!tool || !palOn()) return false;
      placeAt = { x: e.clientX, y: e.clientY, P: at(e) };
      return true;
    }
    function palUp(e) {
      var p = placeAt; placeAt = null;
      if (!p || e.type !== 'pointerup' || Math.hypot(e.clientX - p.x, e.clientY - p.y) >= 5) return false;
      e.stopImmediatePropagation();   // not the viewer's click (it would open an annotation)
      if (!tool) return true;   // let go between the press and the release (Esc)
      placedAt = Date.now();
      makeEntity(p.P, tool.kind);
      if (tool && !tool.sticky) palTake(null);
      return true;
    }
    function freeId(base) {   // an id neither file has
      var s = src(), i = 1;
      var del = sbJs.gone(text), used = function (q) { return text.indexOf('"' + q + '"') >= 0 || s.indexOf('"' + q + '"') >= 0 || s.indexOf("'" + q + "'") >= 0 || del.indexOf(q) >= 0; };   // an id deleted earlier is not used again (a draft reopened on an older build would join them)
      while (used(base + i)) i++;
      return base + i;
    }
    function innermost(P, test) {   // the smallest node round P that passes test
      var best = -1, area = Infinity;
      nodes2.forEach(function (n, i) {
        var b = boxOf(i);
        if (P[0] < b[0] || P[1] < b[1] || P[0] > b[0] + b[2] || P[1] > b[1] + b[3] || !test(n, i)) return;
        if (b[2] * b[3] < area) { area = b[2] * b[3]; best = i; }
      });
      return best;
    }
    function makeEntity(P, cls) {
      var cx = innermost(P, function (n) { return n.el.getAttribute('yfiles.foldertype') === 'group' && !n.comp; });
      if (cx >= 0) { warn('A new entity goes beside a complex for now, not into it.'); return; }
      var D = sbJs.defaults(src(), null, cls), w = D.w, h = D.h, X = P[0] - w / 2, Y2 = P[1] - h / 2;
      if (gridSet.snap) { X += toGrid(X + w / 2, NODE_STEP); Y2 += toGrid(Y2 + h / 2, NODE_STEP); }   // its centre on the grid, as a drag puts it
      var c = innermost(P, function (n) { return n.comp; }), id = freeId('glyph_');
      var t2;
      try { t2 = sbJs.add(text, { id: id, cls: cls, label: '', box: [+fmt(X), +fmt(Y2), w, h], parent: c >= 0 ? nodes2[c].id : null, fill: D.fill, font: D.font }); }
      catch (err) { warn('The ' + cls + ' could not be added: ' + (err && err.message || err) + '.'); return; }
      remember(false); text = t2; made(id);
    }
    // the kinds of glyph the palette makes, and Delete removes (the map's own ones too)
    function isMade(n) { return /^(Macromolecule|SimpleChemical)$/.test(n.shape.kind) && n.el.getAttribute('yfiles.foldertype') !== 'group'; }
    function madeAt(P) { return innermost(P, isMade); }
    // the macromolecule under P, only when it is the innermost such glyph there: a simple chemical lying over a protein
    // takes the right click (found by the review: Add state variable went to the protein under it)
    function macroAt(P) { var i = madeAt(P); return i >= 0 && nodes2[i].shape.kind === 'Macromolecule' ? i : -1; }
    // the places a state variable sits on its node's border, as [rx, ry] (user, 2026-11-14: "it's like with ports"):
    // the corners, each side's middle and the points between them; never marked, a drag always lands on the nearest.
    // ORDER is how new ones fill them, the most used first (user, 2026-11-14: "start from the bottom ... the top is for
    // unit of information"): the bottom's middle, right and left of it, the sides' middles, the bottom corners, the top
    // corners, then the top and the sides' other places
    var ORDER = [[0, 0.5], [0.25, 0.5], [-0.25, 0.5], [0.5, 0], [-0.5, 0], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5],
      [0, -0.5], [0.25, -0.5], [-0.25, -0.5], [0.5, 0.25], [-0.5, 0.25], [0.5, -0.25], [-0.5, -0.25]];
    // a drag lands on the nearest of more places (user, 2026-11-14: "add more snap in between"): each side cut in eighths,
    // so the corners, the middles, the quarters and the points between; the arrow keys move it by single units (below)
    var PLACES = (function () { var out = [], k; for (k = -4; k <= 4; k++) { out.push([k / 8, -0.5], [k / 8, 0.5]); if (Math.abs(k) < 4) out.push([-0.5, k / 8], [0.5, k / 8]); } return out; })();
    function border(i, P) {   // the place nearest P
      var b = boxOf(i), best = null, d0 = Infinity;
      PLACES.forEach(function (q) { var d = Math.hypot(b[0] + (0.5 + q[0]) * b[2] - P[0], b[1] + (0.5 + q[1]) * b[3] - P[1]); if (d < d0) { d0 = d; best = q; } });
      return best.slice();
    }
    // the right-click menu over a macromolecule (not over its state variables or units): Add state variable, Add unit of
    // information, Make multimer or Make macromolecule (user, 2026-11-14: SBGN's names, macromolecule and macromolecule
    // multimer); [label, action] pairs
    window.m2EditNodeItems = function () {
      var P = rclick, i = P && palOn() && !svAt(P) ? macroAt(P) : -1;
      if (i < 0 || !/^macromolecule( multimer)?$/.test(sbJs.classOf(src(), nodes2[i].id))) return null;   // not an Activity Flow activity drawn as one (write() carries none of its changes)
      var id = nodes2[i].id, multi = isMulti(i);
      return [['Add state variable', function () { makeState(P); }],
              ['Add unit of information', function () { typeIn(id, null, true); }],
              [multi ? 'Make macromolecule' : 'Make multimer', function () {
                var t2 = sbJs.multimer(text, id, !multi);
                if (t2 === text) return;
                remember(false); text = t2; made(id);
              }]];
    };
    function isMulti(i) {   // drawn as a multimer: yEd's mcount (sbgn_edit.multimer)
      var r = realizerOf(nodes2[i].el), sp = r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'StyleProperties'; })[0];
      return !!sp && Array.prototype.some.call(sp.children, function (c) { return c.getAttribute('name') === 'com.yworks.sbgn.style.mcount' && c.getAttribute('value') !== '1'; });
    }
    function makeState(P) {   // an empty state variable on the first free place in ORDER (user: "anywhere within the shape ... start from the bottom"), selected to be dragged
      var i = macroAt(P);
      if (i < 0) return;
      var b = boxOf(i), have = svList(i), r = ORDER.filter(function (q) {
        return !have.some(function (h) { return Math.hypot(b[0] + (0.5 + q[0]) * b[2] - h[1][0], b[1] + (0.5 + q[1]) * b[3] - h[1][1]) < Math.max(18, h[2][0]); });
      })[0] || ORDER[0];
      var id = nodes2[i].id, j = have.filter(function (h) { return h[3] === SV; }).length;   // after the state variables, before the units
      remember(false); text = sbJs.state(text, id, '', r[0], r[1]); made(id);
      selN = []; svSel = { id: id, j: j }; paint();
    }
    function made(id) {   // the text changed by a palette action: read again, the node selected, drawn, saved
      parse(); selN = []; selP = []; selE = []; part = null;
      nodes2.forEach(function (n, i) { if (n.id === id) selN = [i]; });
      dirty = true; quiet(); render(); paint(); changed();
    }
    // a node's icons: its state variables and units of information (yEd's names), as one list in the order the node has
    // them (state variables first); svSel's j counts in that list, sbgn_edit counts each kind on its own (q[4])
    var SV = 'StateVariable', UI = 'UnitOfInformation';
    function svIcons() {   // the map's icons of both kinds: id -> [kind, text]
      var res = {};
      Array.prototype.forEach.call(doc.getElementsByTagNameNS(Y, 'Resource'), function (q) {
        var gn = q.getElementsByTagNameNS(Y, 'GenericNode')[0], l = gn && gn.getElementsByTagNameNS(Y, 'NodeLabel')[0], m = gn && /(StateVariable|UnitOfInformation)$/.exec(gn.getAttribute('configuration') || '');
        if (m) res[q.getAttribute('id')] = [m[1], l ? ownText(l) : ''];
      });
      return res;
    }
    function ownText(l) { var t = ''; for (var c = l.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 || c.nodeType === 4) t += c.nodeValue; return t; }
    function svList(i, res) {   // the icons shown on node i: [text, centre in yEd units, size, kind, index among its kind]; res: svIcons(), read once by a caller going through many nodes
      var r = realizerOf(nodes2[i].el), b = boxOf(i), out = [], n = {};
      res = res || svIcons();
      if (r) Array.prototype.forEach.call(r.children, function (l) {
        var q = l.localName === 'NodeLabel' && res[l.getAttribute('iconData')];
        if (!q) return;
        n[q[0]] = (n[q[0]] || 0) + 1;
        out.push([q[1], [b[0] + num(l, 'x') + num(l, 'width') / 2, b[1] + num(l, 'y') + num(l, 'height') / 2], [num(l, 'width'), num(l, 'height')], q[0], n[q[0]] - 1]);
      });
      return out;
    }
    function nameOf(i) {
      var r = realizerOf(nodes2[i].el), l = r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'NodeLabel' && !c.getAttribute('iconData'); })[0];
      return l ? ownText(l) : '';
    }
    // a name (j null), or the j-th icon's text (a state variable's value, a unit of information), typed in a box over the
    // map; Enter or leaving it keeps it, Esc not. fresh: a new unit of information, made only when Enter or leaving it
    // keeps some text (user, 2026-11-14: no predefined units, the reader types N:3, mt:prot, ct:mRNA)
    var typing = null;
    function typeIn(id, j, fresh) {
      if (typing) typing.done(true);
      var i = nodes2.findIndex(function (n) { return n.id === id; });
      if (i < 0) return;
      var b = boxOf(i), sv = j == null ? null : svList(i)[j];
      if (j != null && !sv) return;
      if (fresh) {   // where the converter will put it: the last of the node's units, spread evenly along the top
        var nu = svList(i).filter(function (q) { return q[3] === UI; }).length;
        sv = ['', [b[0] + (nu + 1) / (nu + 2) * b[2], b[1]], [45, 16], UI, nu];
      }
      var unit = !!sv && sv[3] === UI;
      selN = []; selP = []; selE = []; part = null; svSel = null; paint();   // only the cursor while typing, nothing shown selected (user, 2026-11-14)
      // the text edited in place (user, 2026-11-14: "do not change the color ... just simply make it editable"): the box
      // inside the glyph's outline, in its fill, text colour and font size, no frame
      var r = realizerOf(nodes2[i].el), fl = r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'Fill'; })[0];
      var lab = !sv ? r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'NodeLabel' && !c.getAttribute('iconData'); })[0] : null;
      var fs = lab ? num(lab, 'fontSize') || 12 : 10, inset = 2;
      var at0 = !sv ? [b[0] + inset, b[1] + inset, b[2] - 2 * inset, b[3] - 2 * inset] : [sv[1][0] - sv[2][0] / 2 + 1, sv[1][1] - sv[2][1] / 2 + 1, sv[2][0] - 2, sv[2][1] - 2];
      var inp = document.createElement('input'), before = !sv ? nameOf(i) : sv[0], m0 = map;
      inp.type = 'text'; inp.className = 'm2-ed-type'; inp.value = before; inp.spellcheck = false;
      inp.setAttribute('aria-label', !sv ? 'Name' : unit ? 'Unit of information' : 'State variable (value, or value@site)');
      // the drawn text hidden while typing, the field itself transparent (user, 2026-11-14: a filled field cut the shape's
      // rounded corners); before the editor's own drawing is in the page, the field in the glyph's fill. Whether the
      // drawing is there, not whether it has text: an empty glyph has no text to hide and still got the filled box (user,
      // 2026-11-14)
      var hid = fresh ? [] : textsOf(i, j);
      hid.forEach(function (el) { el.style.visibility = 'hidden'; });
      if (fresh) inp.style.border = '1px solid #000';   // nothing drawn yet: the unit's own outline
      inp.style.background = fresh ? '#fff' : gN && gN[nodes2[i].id] ? 'transparent' : !sv && fl && fl.getAttribute('hasColor') !== 'false' && fl.getAttribute('color') ? fl.getAttribute('color').slice(0, 7) : '#fff';
      inp.style.color = lab && lab.getAttribute('textColor') || '#000';
      var place = function () {   // at the glyph in the map's units: again after every zoom or pan (paint), so a pinch keeps it on its glyph
        var st = inp.style;
        if (unit) {   // a unit of information grows with its text round its centre, as the converter sizes it (5.4 a character, 8 more)
          var cx = at0[0] + at0[2] / 2, uw = Math.max(at0[2], Math.ceil(inp.value.length * 5.4 + 8) + 4);
          at0[0] = cx - uw / 2; at0[2] = uw;
        }
        st.left = sx(at0[0]) + 'px'; st.top = sy(at0[1]) + 'px'; st.width = at0[2] * V.z + 'px'; st.height = at0[3] * V.z + 'px'; st.fontSize = fs * V.z + 'px';
        if (sv && !unit) st.borderRadius = at0[3] * V.z / 2 + 'px';
      };
      if (unit) inp.addEventListener('input', place);
      place();
      V.view.appendChild(inp);
      typing = {
        done: function (keep) {
          if (!typing || typing.inp !== inp) return;
          typing = null; inp.remove(); hid.forEach(function (el) { el.style.visibility = ''; });
          var v = inp.value.replace(/[\r\n]+/g, ' ');
          if (sv && !unit) v = v.replace(/@+$/, '');   // P@ is P (a site needs a name)
          if (unit) v = v.trim();   // a unit of only spaces is none
          if (!keep || v === before.replace(/[\r\n]+/g, ' ') || !on || map !== m0 || (fresh && !v)) return;   // a name on several lines, untouched, kept as it was (the box shows it on one)
          var t2 = fresh ? sbJs.unit(text, id, v) : unit && !v ? sbJs.unitDelete(text, id, sv[4], { sbgn: sb.base }) : !sv ? sbJs.label(text, id, v) : unit ? sbJs.unitValue(text, id, sv[4], v) : sbJs.stateValue(text, id, sv[4], v);
          if (t2 === text) return;
          remember(false); text = t2; parse(); dirty = true; quiet(); render(); paint(); changed();
        }, inp: inp, place: place
      };
      inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); typing && typing.done(true); V.view.focus({ preventScroll: true }); }
        else if (e.key === 'Escape') { e.preventDefault(); typing && typing.done(false); V.view.focus({ preventScroll: true }); }
      });
      inp.addEventListener('blur', function () { if (typing && typing.inp === inp) typing.done(true); });
      inp.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      setTimeout(function () { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 0);   // only the cursor, at the end (user: "simple cursor where I need"), nothing selected in blue
    }
    // a double click on a named entity, or on one of its state variables or units of information, opens its text
    V.view.addEventListener('dblclick', function (e) {
      if (!palOn() || !editing(e)) return;
      if (tool || Date.now() - placedAt < 600) { e.stopImmediatePropagation(); return; }   // the clicks of a placing: no box
      var base = src(), P = at(e), q = svAt(P), i = innermost(P, function (n) { return n.el.getAttribute('yfiles.foldertype') !== 'group' && sbJs.nameable(base, n.id); });
      if (q) { e.stopImmediatePropagation(); typeIn(nodes2[q[0]].id, q[1]); return; }
      if (i >= 0) { e.stopImmediatePropagation(); typeIn(nodes2[i].id, null); }
    }, true);
    function svAt(P) {   // the state variable or unit of information under P: [node, j] (it may stand out of its node)
      var res = svIcons(), found = null, pad = 3 / V.z;
      nodes2.forEach(function (n, k) {
        if (n.shape.kind !== 'Macromolecule') return;
        svList(k, res).forEach(function (q, j) { if (Math.abs(P[0] - q[1][0]) <= q[2][0] / 2 + pad && Math.abs(P[1] - q[1][1]) <= q[2][1] / 2 + pad) found = [k, j]; });
      });
      return found;
    }

    // a state variable selected (user, 2026-11-14): a click selects it, a drag moves it along its node's border, snapping
    // to the nearest of its places (PLACES) only, its own drawing following; the arrow keys move it by single units; a click on it selected opens its text; Delete or the right-click menu
    // deletes it
    var svSel = null, svDrag = null, svKey = null;   // svSel: { id, j }; svKey: a move by the arrow keys under way
    function svNode() { if (!svSel) return -1; var i = nodes2.findIndex(function (n) { return n.id === svSel.id; }); return i >= 0 && svList(i)[svSel.j] ? i : -1; }
    function svMarks(over) {   // four black squares at the corners of the state variable selected (paint, core.js)
      if (typing) typing.place();   // the text field follows a zoom or a pan (user, 2026-11-14: it stayed where it was)
      var i = svNode();
      if (i < 0 || !palOn()) { svSel = null; return; }
      var q = svList(i)[svSel.j], c = svDrag && svDrag.to ? svDrag.to : svKey ? svKey.to : q[1], hs = Math.max(2, HANDLE * V.z);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d) {
        over.push('<rect class="m2-ed-handle" x="' + f1(sx(c[0] + d[0] * q[2][0] / 2) - hs / 2) + '" y="' + f1(sy(c[1] + d[1] * q[2][1] / 2) - hs / 2) + '" width="' + f1(hs) + '" height="' + f1(hs) + '"/>');
      });
    }
    // a press on a state variable (called by the core's press before nodes, user, 2026-11-14: "the state variable ... is on
    // the top": a click on it selects it, also over its macromolecule, selected or not); true when it takes the press
    function svDown(e, P, h) {
      var q = palOn() && !tool ? svAt(P) : null;
      if (!q || e.shiftKey || (h && h.p != null)) { if (svSel) { svSel = null; paint(); } return false; }   // Shift or a bend point there: the core's
      e.stopImmediatePropagation();
      V.view.focus({ preventScroll: true });
      var again = !!svSel && svSel.id === nodes2[q[0]].id && svSel.j === q[1];
      selN = []; selP = []; selE = []; part = null;
      svSel = { id: nodes2[q[0]].id, j: q[1] };
      svDrag = { i: q[0], again: again, x: e.clientX, y: e.clientY, to: null, r: null, fixed: svList(q[0])[q[1]][3] === UI };   // a unit of information stays where the converter puts it
      paint();
      return true;
    }
    function textsOf(i, j) {   // the drawn text of node i's name (j null) or of its j-th icon
      var g = gN && gN[nodes2[i].id];
      if (!g) return [];
      var svs = svList(i), r = V.view.getBoundingClientRect(), k = V.pz();
      var rect = function (q) { var L = r.left + sx(q[1][0] - q[2][0] / 2) * k, T = r.top + sy(q[1][1] - q[2][1] / 2) * k; return [L - 1.5, T - 1.5, L + q[2][0] * V.z * k + 1.5, T + q[2][1] * V.z * k + 1.5]; };
      var inside = function (b, R) { var cx = b.left + b.width / 2, cy = b.top + b.height / 2; return cx >= R[0] && cx <= R[2] && cy >= R[1] && cy <= R[3]; };
      return Array.prototype.filter.call(g.querySelectorAll('text'), function (t) {
        var b = t.getBoundingClientRect();
        return j == null ? !svs.some(function (q) { return inside(b, rect(q)); }) : inside(b, rect(svs[j]));
      });
    }
    function svParts(i, q) {   // the drawn parts of a state variable (its box, outline, text) in its node's group of the editor's drawing
      var g = gN && gN[nodes2[i].id];
      if (!g) return [];
      var first = g.firstElementChild && g.firstElementChild.localName === 'a' ? g.firstElementChild : g, r = V.view.getBoundingClientRect(), k = V.pz();
      var L = r.left + sx(q[1][0] - q[2][0] / 2) * k - 1.5, T = r.top + sy(q[1][1] - q[2][1] / 2) * k - 1.5, R = L + q[2][0] * V.z * k + 3, B = T + q[2][1] * V.z * k + 3;
      return Array.prototype.filter.call(first.children, function (el) {
        var b = el.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        return b.width + b.height > 0 && cx >= L && cx <= R && cy >= T && cy <= B && b.left >= L - 2 && b.right <= R + 2 && b.top >= T - 2 && b.bottom <= B + 2;
      });
    }
    window.addEventListener('pointermove', function (e) {
      if (!svDrag || !svSel) return;
      if (!e.buttons) { svUp(); return; }   // released outside the window: no sticky hand
      if (!svDrag.to && Math.hypot(e.clientX - svDrag.x, e.clientY - svDrag.y) < 4) return;
      if (svDrag.fixed) { svDrag.moved = true; return; }   // a unit of information is not dragged; a drag on it is no click
      var i = svDrag.i, b = boxOf(i), r = border(i, at(e)), q = svList(i)[svSel.j];
      if (!svDrag.parts) svDrag.parts = svParts(i, q);   // the state variable itself moves (user, 2026-11-14: "as with moving other items on the map"), no copy
      svDrag.r = r; svDrag.to = [b[0] + (0.5 + r[0]) * b[2], b[1] + (0.5 + r[1]) * b[3]];
      var dx = svDrag.to[0] - q[1][0], dy = svDrag.to[1] - q[1][1];
      svDrag.parts.forEach(function (el) { if (dx || dy) el.setAttribute('transform', 'translate(' + f1(dx) + ' ' + f1(dy) + ')'); else el.removeAttribute('transform'); });
      paint();
    }, true);
    window.addEventListener('pointerup', svUp, true);   // capture: the core's own handlers may stop the release on the map
    function svUp() {
      var d = svDrag; svDrag = null;
      if (!d) return;
      if (d.r && svSel) { remember(false); text = sbJs.stateMove(text, svSel.id, svList(d.i)[svSel.j][4], d.r[0], d.r[1]); parse(); dirty = true; render(); paint(); changed(); }
      else if (d.again && !d.moved && svSel) typeIn(svSel.id, svSel.j);   // a click on it selected: its text
    }
    function svDelete() {
      var i = svNode();
      if (i < 0) return false;
      var q = svList(i)[svSel.j];
      remember(false); text = (q[3] === UI ? sbJs.unitDelete : sbJs.stateDelete)(text, svSel.id, q[4], { sbgn: sb.base }); svSel = null;
      parse(); dirty = true; render(); paint(); changed();
      return true;
    }
    function nodesDelete(list) {   // macromolecules and simple chemicals deleted with every line at them
      var ids = list.filter(function (i) { return isMade(nodes2[i]); }).map(function (i) { return nodes2[i].id; });
      if (!ids.length) return false;
      remember(false); text = sbJs.remove(text, ids); selN = []; selP = []; selE = []; part = null;
      parse(); dirty = true; render(); paint(); changed();
      return true;
    }
    // the arrow keys move the state variable selected round its node's border by 1 unit, with Shift by 10 (user,
    // 2026-11-14: "pixel by pixel ... it would move along the border"), free of the places. The key's direction along the
    // side: on the bottom Right and Down go right, Left and Up go left; a key across the side goes clockwise inward,
    // anticlockwise outward. A key held keeps its first direction round the corners ("it kind of pushes it all the way").
    // Drawn live, written once on the key's release (one undo step)
    var KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    function perim(b) { return 2 * (b[2] + b[3]); }
    function toT(b, r) {   // a place [rx, ry] on the border as its distance clockwise from the top left corner
      var w = b[2], h = b[3], dt = Math.abs(r[1] + 0.5) * h, dr = Math.abs(r[0] - 0.5) * w, db = Math.abs(r[1] - 0.5) * h, dl = Math.abs(r[0] + 0.5) * w, m = Math.min(dt, dr, db, dl);
      if (m === dt) return (r[0] + 0.5) * w;
      if (m === dr) return w + (r[1] + 0.5) * h;
      if (m === db) return w + h + (0.5 - r[0]) * w;
      return 2 * w + h + (0.5 - r[1]) * h;
    }
    function fromT(b, t) {
      var w = b[2], h = b[3], P = perim(b); t = ((t % P) + P) % P;
      if (t < w) return [t / w - 0.5, -0.5];
      if (t < w + h) return [0.5, (t - w) / h - 0.5];
      if (t < 2 * w + h) return [0.5 - (t - w - h) / w, 0.5];
      return [-0.5, 0.5 - (t - 2 * w - h) / h];
    }
    function keyDir(b, t, d) {   // +1 clockwise, -1 anticlockwise; as the arrow points wherever it can (user: "if it's on the side, down would be down")
      var w = b[2], h = b[3], P = perim(b), sideOf = function (u) { u = ((u % P) + P) % P; return u < w ? 0 : u < w + h ? 1 : u < 2 * w + h ? 2 : 3; };
      var TAN = [[1, 0], [0, 1], [-1, 0], [0, -1]], OUT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      var sides = [sideOf(t), sideOf(t - 0.5), sideOf(t + 0.5)];   // at a corner both its sides: the one the arrow runs along
      for (var k = 0; k < sides.length; k++) { var a = d[0] * TAN[sides[k]][0] + d[1] * TAN[sides[k]][1]; if (a) return Math.sign(a); }
      return d[0] * OUT[sides[0]][0] + d[1] * OUT[sides[0]][1] > 0 ? -1 : 1;   // across the side: clockwise inward, anticlockwise outward
    }
    document.addEventListener('keydown', function (e) {
      var d = KEYS[e.key];
      if (!d || !svSel || !palOn() || e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      var i = svNode();
      if (i < 0 || svList(i)[svSel.j][3] === UI) return;   // a unit of information: not moved
      e.preventDefault(); e.stopImmediatePropagation();
      var b = boxOf(i), q = svList(i)[svSel.j];
      if (!svKey) svKey = { i: i, t: toT(b, [(q[1][0] - b[0]) / b[2] - 0.5, (q[1][1] - b[1]) / b[3] - 0.5]), c0: q[1], parts: svParts(i, q) };
      if (!e.repeat || svKey.key !== e.key) { svKey.key = e.key; svKey.dir = keyDir(b, ((svKey.t % perim(b)) + perim(b)) % perim(b), d); }
      svKey.t += svKey.dir * (e.shiftKey ? 10 : 1);
      var r = fromT(b, svKey.t);
      svKey.r = [Math.round(r[0] * 10000) / 10000, Math.round(r[1] * 10000) / 10000];
      svKey.to = [b[0] + (0.5 + svKey.r[0]) * b[2], b[1] + (0.5 + svKey.r[1]) * b[3]];
      var dx = svKey.to[0] - svKey.c0[0], dy = svKey.to[1] - svKey.c0[1];
      svKey.parts.forEach(function (el) { el.setAttribute('transform', 'translate(' + f1(dx) + ' ' + f1(dy) + ')'); });
      paint();
    }, true);
    document.addEventListener('keyup', function (e) {
      if (!KEYS[e.key] || !svKey) return;
      var k = svKey; svKey = null;
      if (!k.r || !svSel) return;
      remember(false); text = sbJs.stateMove(text, svSel.id, svList(k.i)[svSel.j][4], k.r[0], k.r[1]); parse(); dirty = true; render(); paint(); changed();
    }, true);
    document.addEventListener('keydown', function (e) {   // Esc, undo, redo and select all leave no state variable selected
      if (svSel && (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && /^[zya]$/i.test(e.key)))) { svSel = null; paint(); }
    }, true);
    document.addEventListener('keydown', function (e) {
      if ((e.key !== 'Delete' && e.key !== 'Backspace') || !palOn() || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (svDelete() || (selN.length && !selP.length && nodesDelete(selN))) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    window.m2EditDelete = function () {   // the right-click menu's Delete over a state variable, a unit of information, a macromolecule or a simple chemical
      if (!palOn() || !rclick) return null;
      var q = svAt(rclick);
      if (q) return function () { svSel = { id: nodes2[q[0]].id, j: q[1] }; svDelete(); };
      var i = madeAt(rclick);
      if (i < 0) return null;
      return function () { nodesDelete(selN.indexOf(i) >= 0 ? selN : [i]); };
    };

    // a sign dragged from the palette onto the map (user, 2026-11-14): the future node at its own size and the map's zoom
    // follows the pointer inside the map window only, so over the panel it is hidden behind it and slides in as it nears
    // the map ("as if it is already on the map ... behind the panel"); it is put where it is dropped
    var palDrag = null;
    pal.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('button[data-make]');
      if (b && e.button === 0) palDrag = { kind: b.dataset.make, x: e.clientX, y: e.clientY, img: null };
    });
    function palOver(e) { var r = V.view.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
    window.addEventListener('pointermove', function (e) {
      if (!palDrag) return;
      if (!e.buttons) { if (palDrag.img) palDrag.img.remove(); palDrag = null; return; }   // released outside the window
      if (!palDrag.moved && Math.hypot(e.clientX - palDrag.x, e.clientY - palDrag.y) < 5) return;
      palDrag.moved = true;
      if (!palOn()) { if (palDrag.img) palDrag.img.hidden = true; return; }
      if (!palDrag.img) {   // in the map window from the start, so it slides in from behind the panel as it nears the map (user, 2026-11-14)
        var D = sbJs.defaults(src(), null, palDrag.kind);
        palDrag.img = document.createElement('div'); palDrag.img.className = 'm2-ed-palghost';
        palDrag.img.style.cssText = 'width:' + D.w * V.z + 'px;height:' + D.h * V.z + 'px';
        // drawn as the renderer draws a macromolecule (user, 2026-11-14: a CSS box with a 1 px border looked thin, its
        // corners round where yrender's are quadratic): its path in map units (radius 10, as sbgn_edit writes), stroke 1; a
        // simple chemical a circle (yrender's round rectangle of radius half its side)
        var w = D.w, h = D.h, q = Math.min(10, w / 2, h / 2), paint0 = '" fill="' + (D.fill || '#fff') + '" stroke="#000" stroke-width="1"/></svg>';
        palDrag.img.innerHTML = '<svg width="100%" height="100%" viewBox="0 0 ' + w + ' ' + h + '" overflow="visible">' + (palDrag.kind === 'simple chemical'
          ? '<rect width="' + w + '" height="' + h + '" rx="' + Math.min(w, h) / 2 + paint0
          : '<path d="M0 ' + q + ' Q0 0 ' + q + ' 0 L' + (w - q) + ' 0 Q' + w + ' 0 ' + w + ' ' + q + ' L' + w + ' ' + (h - q) + ' Q' + w + ' ' + h + ' ' + (w - q) + ' ' + h +
            ' L' + q + ' ' + h + ' Q0 ' + h + ' 0 ' + (h - q) + ' Z' + paint0);
        V.view.appendChild(palDrag.img);
      }
      var r = V.view.getBoundingClientRect(), g = palDrag.img;
      g.hidden = false;
      g.style.left = (e.clientX - r.left) / V.pz() - g.offsetWidth / 2 + 'px'; g.style.top = (e.clientY - r.top) / V.pz() - g.offsetHeight / 2 + 'px';
    }, true);
    window.addEventListener('pointerup', function (e) {
      var d = palDrag; palDrag = null;
      if (!d || !d.moved) return;
      if (d.img) d.img.remove();
      if (!palOver(e) || !palOn()) return;
      placedAt = Date.now();
      makeEntity(at(e), d.kind);
    }, true);
