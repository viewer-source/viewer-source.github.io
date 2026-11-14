    // ---------- making new things: the palette (editor/src/create.js) ----------
    // The full editor (user, 2026-11-14): entities taken from a palette in the Edit window, as in yEd and Newt. A click on
    // a sign takes it for one use: the next click on the map puts it there and the sign lets go; a double click keeps it
    // in hand for several in a row, until a click on the sign again or Esc (user: "this tool stick to your hand"); a sign
    // dragged onto the map is put where it is dropped. The pointer stays the plain arrow. Only with Settings, Editing on
    // Full, and for now only on SBGN-ML maps: sbgn_edit (renderers/converter/sbgn_edit.js, its master, tested against the
    // converter by tests/sbgn-create.js) writes what is made into the editor's GraphML as the converter writes it, and
    // into the SBGN-ML file. So far: a macromolecule, its name, its state variables (added from the right-click menu over
    // a macromolecule, user: "Auxiliary units - remove this section, to be added via right click"), and deleting them.
    // Nothing asks for a name when made (user: "I will name when I want to name"): a double click on a named entity or a
    // state variable, or a click on a state variable already selected, opens its text in place, in the glyph's own
    // colours and font (user: "simply make it editable for the text"); Enter or a click elsewhere keeps it, Esc not.
    var PAL = [
      ['Entity pool nodes', [['macromolecule', 'Macromolecule', '<rect x="6" y="5" width="28" height="14" rx="4"/>']]]
    ];
    var tool = null;   // { kind, sticky } in hand
    var pal = document.createElement('div');
    pal.className = 'm2-ed-palette'; pal.hidden = true; pal.setAttribute('role', 'toolbar'); pal.setAttribute('aria-label', 'Palette');
    pal.innerHTML = PAL.map(function (s) {
      return '<p>' + s[0] + '</p><div class="m2-ed-prow">' + s[1].map(function (q) {
        return '<button type="button" data-make="' + q[0] + '" title="' + q[1] + ' (click: once; double click: several)" aria-label="' + q[1] + '" aria-pressed="false">' +
          '<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" aria-hidden="true">' + q[2] + '</svg></button>';
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
      if (tool.kind === 'macromolecule') makeEntity(p.P);
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
    function makeEntity(P) {
      var cx = innermost(P, function (n) { return n.el.getAttribute('yfiles.foldertype') === 'group' && !n.comp; });
      if (cx >= 0) { warn('A new entity goes beside a complex for now, not into it.'); return; }
      var D = sbJs.defaults(src()), w = D.w, h = D.h, X = P[0] - w / 2, Y2 = P[1] - h / 2;
      if (gridSet.snap) { X += toGrid(X + w / 2, NODE_STEP); Y2 += toGrid(Y2 + h / 2, NODE_STEP); }   // its centre on the grid, as a drag puts it
      var c = innermost(P, function (n) { return n.comp; }), id = freeId('glyph_');
      var t2;
      try { t2 = sbJs.add(text, { id: id, cls: 'macromolecule', label: '', box: [+fmt(X), +fmt(Y2), w, h], parent: c >= 0 ? nodes2[c].id : null, fill: D.fill, font: D.font }); }
      catch (err) { warn('The macromolecule could not be added: ' + (err && err.message || err) + '.'); return; }
      remember(false); text = t2; made(id);
    }
    function macroAt(P) { return innermost(P, function (n) { return n.shape.kind === 'Macromolecule' && n.el.getAttribute('yfiles.foldertype') !== 'group'; }); }
    // the places a state variable snaps to on its node's border: each side's middle, quarters and corners, as [rx, ry]
    var SNAPS = (function () { var out = [], q = [-0.5, -0.25, 0, 0.25, 0.5]; q.forEach(function (v) { out.push([v, -0.5], [v, 0.5]); if (Math.abs(v) < 0.5) out.push([-0.5, v], [0.5, v]); }); return out; })();
    function border(i, P) {   // P put on node i's border: [rx, ry], snapped to a place within 8 screen pixels
      var b = boxOf(i), dx = (P[0] - b[0] - b[2] / 2) / b[2], dy = (P[1] - b[1] - b[3] / 2) / b[3], cl = function (v) { return Math.max(-0.5, Math.min(0.5, v)); };
      var side = (0.5 - Math.abs(dx)) * b[2] < (0.5 - Math.abs(dy)) * b[3];   // a left or right side nearer than the top or bottom
      var r = side ? [dx < 0 ? -0.5 : 0.5, cl(dy)] : [cl(dx), dy <= 0 ? -0.5 : 0.5], best = 8 / V.z;
      SNAPS.forEach(function (q) { var d = Math.hypot((q[0] - r[0]) * b[2], (q[1] - r[1]) * b[3]); if (d < best) { best = d; r = q.slice(); } });
      return [Math.round(r[0] * 1000) / 1000, Math.round(r[1] * 1000) / 1000];
    }
    window.m2EditAddState = function () {   // the right-click menu's Add state variable over a macromolecule
      var P = rclick;
      if (!palOn() || !P || svAt(P) || macroAt(P) < 0) return null;
      return function () { makeState(P); };
    };
    function makeState(P) {   // an empty state variable on the free place nearest the click (user: "it kind of snaps to one of the places if available"), selected to be dragged
      var i = macroAt(P);
      if (i < 0) return;
      var b = boxOf(i), have = svList(i), want = border(i, P), free = SNAPS.filter(function (q) {
        return !have.some(function (h) { return Math.hypot(b[0] + (0.5 + q[0]) * b[2] - h[1][0], b[1] + (0.5 + q[1]) * b[3] - h[1][1]) < Math.max(18, h[2][0]); });
      });
      var dist = function (q) { return Math.hypot((q[0] - want[0]) * b[2], (q[1] - want[1]) * b[3]); };
      var r = free.length ? free.sort(function (x, y) { return dist(x) - dist(y); })[0] : want;
      var id = nodes2[i].id, j = have.length;
      remember(false); text = sbJs.state(text, id, '', r[0], r[1]); made(id);
      selN = []; svSel = { id: id, j: j }; paint();
    }
    function made(id) {   // the text changed by a palette action: read again, the node selected, drawn, saved
      parse(); selN = []; selP = []; selE = []; part = null;
      nodes2.forEach(function (n, i) { if (n.id === id) selN = [i]; });
      dirty = true; quiet(); render(); paint(); changed();
    }
    function svIcons() {   // the map's state variable icons: id -> text
      var res = {};
      Array.prototype.forEach.call(doc.getElementsByTagNameNS(Y, 'Resource'), function (q) {
        var gn = q.getElementsByTagNameNS(Y, 'GenericNode')[0], l = gn && gn.getElementsByTagNameNS(Y, 'NodeLabel')[0];
        if (gn && /StateVariable$/.test(gn.getAttribute('configuration') || '')) res[q.getAttribute('id')] = l ? ownText(l) : '';
      });
      return res;
    }
    function ownText(l) { var t = ''; for (var c = l.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 || c.nodeType === 4) t += c.nodeValue; return t; }
    function svList(i, res) {   // the state variables shown on node i: [text, centre in yEd units, size]; res: svIcons(), read once by a caller going through many nodes
      var r = realizerOf(nodes2[i].el), b = boxOf(i), out = [];
      res = res || svIcons();
      if (r) Array.prototype.forEach.call(r.children, function (l) {
        if (l.localName !== 'NodeLabel' || !(l.getAttribute('iconData') in res)) return;
        out.push([res[l.getAttribute('iconData')], [b[0] + num(l, 'x') + num(l, 'width') / 2, b[1] + num(l, 'y') + num(l, 'height') / 2], [num(l, 'width'), num(l, 'height')]]);
      });
      return out;
    }
    function nameOf(i) {
      var r = realizerOf(nodes2[i].el), l = r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'NodeLabel' && !c.getAttribute('iconData'); })[0];
      return l ? ownText(l) : '';
    }
    // a name (j null) or the j-th state variable's value typed in a box over the map; Enter or leaving it keeps it, Esc not
    var typing = null;
    function typeIn(id, j) {
      if (typing) typing.done(true);
      var i = nodes2.findIndex(function (n) { return n.id === id; });
      if (i < 0) return;
      var b = boxOf(i), sv = j == null ? null : svList(i)[j];
      if (j != null && !sv) return;
      selN = []; selP = []; selE = []; part = null; svSel = null; paint();   // only the cursor while typing, nothing shown selected (user, 2026-11-14)
      // the text edited in place (user, 2026-11-14: "do not change the color ... just simply make it editable"): the box
      // inside the glyph's outline, in its fill, text colour and font size, no frame
      var r = realizerOf(nodes2[i].el), fl = r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'Fill'; })[0];
      var lab = j == null ? r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'NodeLabel' && !c.getAttribute('iconData'); })[0] : null;
      var fs = lab ? num(lab, 'fontSize') || 12 : 10, inset = 2;
      var at0 = j == null ? [b[0] + inset, b[1] + inset, b[2] - 2 * inset, b[3] - 2 * inset] : [sv[1][0] - sv[2][0] / 2 + 1, sv[1][1] - sv[2][1] / 2 + 1, sv[2][0] - 2, sv[2][1] - 2];
      var inp = document.createElement('input'), before = j == null ? nameOf(i) : sv[0], m0 = map;
      inp.type = 'text'; inp.className = 'm2-ed-type'; inp.value = before; inp.spellcheck = false;
      inp.setAttribute('aria-label', j == null ? 'Name' : 'State variable (value, or value@site)');
      inp.style.cssText = 'left:' + sx(at0[0]) + 'px;top:' + sy(at0[1]) + 'px;width:' + at0[2] * V.z + 'px;height:' + at0[3] * V.z + 'px;font-size:' + fs * V.z + 'px;' +
        'background:' + (j == null && fl && fl.getAttribute('hasColor') !== 'false' && fl.getAttribute('color') ? fl.getAttribute('color').slice(0, 7) : '#fff') + ';color:' + (lab && lab.getAttribute('textColor') || '#000') +
        (j == null ? '' : ';border-radius:' + at0[3] * V.z / 2 + 'px');
      V.view.appendChild(inp);
      typing = {
        done: function (keep) {
          if (!typing || typing.inp !== inp) return;
          typing = null; inp.remove();
          var v = inp.value.replace(/[\r\n]+/g, ' ');
          if (j != null) v = v.replace(/@+$/, '');   // P@ is P (a site needs a name)
          if (!keep || v === before.replace(/[\r\n]+/g, ' ') || !on || map !== m0) return;   // a name on several lines, untouched, kept as it was (the box shows it on one)
          var t2 = j == null ? sbJs.label(text, id, v) : sbJs.stateValue(text, id, j, v);
          if (t2 === text) return;
          remember(false); text = t2; parse(); dirty = true; quiet(); render(); paint(); changed();
        }, inp: inp
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
    // a double click on a named entity, or on one of its state variables, opens its text
    V.view.addEventListener('dblclick', function (e) {
      if (!palOn() || !editing(e)) return;
      if (tool || Date.now() - placedAt < 600) { e.stopImmediatePropagation(); return; }   // the clicks of a placing: no box
      var base = src(), P = at(e), q = svAt(P), i = innermost(P, function (n) { return n.el.getAttribute('yfiles.foldertype') !== 'group' && sbJs.nameable(base, n.id); });
      if (q) { e.stopImmediatePropagation(); typeIn(nodes2[q[0]].id, q[1]); return; }
      if (i >= 0) { e.stopImmediatePropagation(); typeIn(nodes2[i].id, null); }
    }, true);
    function svAt(P) {   // the state variable under P: [node, j] (its circle may stand out of its node)
      var res = svIcons(), found = null, pad = 3 / V.z;
      nodes2.forEach(function (n, k) {
        if (n.shape.kind !== 'Macromolecule') return;
        svList(k, res).forEach(function (q, j) { if (Math.abs(P[0] - q[1][0]) <= q[2][0] / 2 + pad && Math.abs(P[1] - q[1][1]) <= q[2][1] / 2 + pad) found = [k, j]; });
      });
      return found;
    }

    // a state variable selected (user, 2026-11-14): a click selects it, a drag moves it along its node's border, snapping
    // to the sides' middles, quarters and corners; a click on it selected opens its text; Delete or the right-click menu
    // deletes it
    var svSel = null, svDrag = null, ghost = null;   // svSel: { id, j }
    function svNode() { if (!svSel) return -1; var i = nodes2.findIndex(function (n) { return n.id === svSel.id; }); return i >= 0 && svList(i)[svSel.j] ? i : -1; }
    function svMarks(over) {   // four black squares at the corners of the state variable selected (paint, core.js)
      var i = svNode();
      if (i < 0 || !palOn()) { svSel = null; return; }
      var q = svList(i)[svSel.j], c = svDrag && svDrag.to ? svDrag.to : q[1], hs = Math.max(2, HANDLE * V.z);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d) {
        over.push('<rect class="m2-ed-handle" x="' + f1(sx(c[0] + d[0] * q[2][0] / 2) - hs / 2) + '" y="' + f1(sy(c[1] + d[1] * q[2][1] / 2) - hs / 2) + '" width="' + f1(hs) + '" height="' + f1(hs) + '"/>');
      });
    }
    V.view.addEventListener('pointerdown', function (e) {
      if (!palOn() || tool || e.button !== 0 || !editing(e)) return;
      var P = at(e), q = svAt(P), h = q && !e.shiftKey && hit(P);
      if (!q || e.shiftKey || (h && h.p != null) || selE.length) { if (svSel) { svSel = null; paint(); } return; }   // Shift, a bend point there, or a line selected (its end squares): the core's
      e.stopImmediatePropagation();
      V.view.focus({ preventScroll: true });
      var again = !!svSel && svSel.id === nodes2[q[0]].id && svSel.j === q[1];
      selN = []; selP = []; selE = []; part = null;
      svSel = { id: nodes2[q[0]].id, j: q[1] };
      svDrag = { i: q[0], again: again, x: e.clientX, y: e.clientY, to: null, r: null };
      paint();
    }, true);
    window.addEventListener('pointermove', function (e) {
      if (!svDrag || !svSel) return;
      if (!e.buttons) { svUp(); return; }   // released outside the window: no sticky hand
      if (!svDrag.to && Math.hypot(e.clientX - svDrag.x, e.clientY - svDrag.y) < 4) return;
      var i = svDrag.i, b = boxOf(i), r = border(i, at(e)), q = svList(i)[svSel.j];
      svDrag.r = r; svDrag.to = [b[0] + (0.5 + r[0]) * b[2], b[1] + (0.5 + r[1]) * b[3]];
      if (!ghost) { ghost = document.createElement('div'); ghost.className = 'm2-ed-svghost'; V.view.appendChild(ghost); }
      var w = q[2][0] * V.z, h = q[2][1] * V.z;
      ghost.textContent = q[0];
      ghost.style.cssText = 'left:' + (sx(svDrag.to[0]) - w / 2) + 'px;top:' + (sy(svDrag.to[1]) - h / 2) + 'px;width:' + w + 'px;height:' + h + 'px;font-size:' + 10 * V.z + 'px;border-radius:' + h / 2 + 'px';
      paint();
    }, true);
    window.addEventListener('pointerup', svUp, true);   // capture: the core's own handlers may stop the release on the map
    function svUp() {
      var d = svDrag; svDrag = null;
      if (ghost) { ghost.remove(); ghost = null; }
      if (!d) return;
      if (d.r && svSel) { remember(false); text = sbJs.stateMove(text, svSel.id, svSel.j, d.r[0], d.r[1]); parse(); dirty = true; render(); paint(); changed(); }
      else if (d.again && svSel) typeIn(svSel.id, svSel.j);   // a click on it selected: its text
    }
    function svDelete() {
      if (svNode() < 0) return false;
      remember(false); text = sbJs.stateDelete(text, svSel.id, svSel.j, { sbgn: sb.base }); svSel = null;
      parse(); dirty = true; render(); paint(); changed();
      return true;
    }
    function nodesDelete(list) {   // macromolecules deleted with every line at them
      var ids = list.filter(function (i) { return nodes2[i].shape.kind === 'Macromolecule' && nodes2[i].el.getAttribute('yfiles.foldertype') !== 'group'; }).map(function (i) { return nodes2[i].id; });
      if (!ids.length) return false;
      remember(false); text = sbJs.remove(text, ids); selN = []; selP = []; selE = []; part = null;
      parse(); dirty = true; render(); paint(); changed();
      return true;
    }
    document.addEventListener('keydown', function (e) {   // Esc, undo, redo and select all leave no state variable selected
      if (svSel && (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && /^[zya]$/i.test(e.key)))) { svSel = null; paint(); }
    }, true);
    document.addEventListener('keydown', function (e) {
      if ((e.key !== 'Delete' && e.key !== 'Backspace') || !palOn() || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (svDelete() || (selN.length && !selP.length && nodesDelete(selN))) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    window.m2EditDelete = function () {   // the right-click menu's Delete over a state variable or a macromolecule
      if (!palOn() || !rclick) return null;
      var q = svAt(rclick);
      if (q) return function () { svSel = { id: nodes2[q[0]].id, j: q[1] }; svDelete(); };
      var i = macroAt(rclick);
      if (i < 0) return null;
      return function () { nodesDelete(selN.indexOf(i) >= 0 ? selN : [i]); };
    };

    // a sign dragged from the palette onto the map (user, 2026-11-14): nothing shown over the panel; over the map the
    // future node at its own size and the map's zoom follows the pointer, and is put where it is dropped
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
      if (!palOver(e) || !palOn()) { if (palDrag.img) palDrag.img.hidden = true; return; }
      if (!palDrag.img) {
        var D = sbJs.defaults(src());
        palDrag.img = document.createElement('div'); palDrag.img.className = 'm2-ed-palghost';
        palDrag.img.style.cssText = 'width:' + D.w * V.z + 'px;height:' + D.h * V.z + 'px;border-radius:' + 10 * V.z + 'px;background:' + (D.fill || '#fff');
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
      if (d.kind === 'macromolecule') makeEntity(at(e));
    }, true);
