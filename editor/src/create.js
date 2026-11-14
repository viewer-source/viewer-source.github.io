    // ---------- making new things: the palette (editor/src/create.js) ----------
    // The full editor (user, 2026-11-14): entities taken from a palette in the Edit window, as in yEd and Newt, never from
    // the right-click menu (that stays for what is on the map already). A click on a sign takes it for one use: the next
    // click on the map puts it there and the sign lets go; a double click keeps it in hand for several in a row, until a
    // click on the sign again or Esc (user: "this tool stick to your hand"). Only with Settings, Editing on Full, and for
    // now only on SBGN-ML maps: sbgn_edit (renderers/converter/sbgn_edit.js, its master, tested against the converter by
    // tests/sbgn-create.js) writes what is made into the editor's GraphML as the converter writes it, and into the SBGN-ML
    // file. So far: a macromolecule, its name, its state variables. A name or a value is typed in a box over the map that
    // opens at once (Enter or a click elsewhere keeps it, Esc leaves it as it was); a double click on a named entity or
    // on a state variable opens it again. Adding and naming are one undo step.
    var PAL = [
      ['Entity pool nodes', [['macromolecule', 'Macromolecule', '<rect x="6" y="5" width="28" height="14" rx="4"/>']]],
      ['Auxiliary units', [['state', 'State variable (on a macromolecule)', '<rect x="6" y="9" width="28" height="11" rx="3"/><ellipse cx="20" cy="9" rx="5" ry="4.5" fill="var(--m2-bg, #fff)"/>']]]
    ];
    var tool = null;   // { kind, sticky } in hand
    var pal = document.createElement('div');
    pal.className = 'm2-ed-palette'; pal.hidden = true; pal.setAttribute('role', 'toolbar'); pal.setAttribute('aria-label', 'Palette');
    pal.innerHTML = PAL.map(function (s) {
      return '<p>' + s[0] + '</p><div class="m2-ed-prow">' + s[1].map(function (q) {
        return '<button type="button" data-make="' + q[0] + '" title="' + q[1] + ' (click: once; double click: several)" aria-label="' + q[1] + '" aria-pressed="false">' +
          '<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' + q[2] + '</svg></button>';
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
      if (!tool && V.view.style.cursor === 'crosshair') V.view.style.cursor = '';
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
      else if (tool.kind === 'state') makeState(p.P);
      if (tool && !tool.sticky) palTake(null);
      return true;
    }
    function freeId(base) {   // an id neither file has
      var s = src(), i = 1;
      var used = function (q) { return text.indexOf('"' + q + '"') >= 0 || s.indexOf('"' + q + '"') >= 0 || s.indexOf("'" + q + "'") >= 0; };
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
      typeIn(id, null, true);
    }
    function makeState(P) {
      var i = innermost(P, function (n) { return n.shape.kind === 'Macromolecule' && n.el.getAttribute('yfiles.foldertype') !== 'group'; });
      if (i < 0) { warn('A state variable goes on a macromolecule: click on one.'); return; }
      var b = boxOf(i), dx = (P[0] - b[0] - b[2] / 2) / b[2], dy = (P[1] - b[1] - b[3] / 2) / b[3], r2 = function (v) { return Math.round(Math.max(-0.5, Math.min(0.5, v)) * 100) / 100; };
      var side = (0.5 - Math.abs(dx)) * b[2] < (0.5 - Math.abs(dy)) * b[3];   // a left or right side nearer than the top or bottom
      var rx = side ? (dx < 0 ? -0.5 : 0.5) : r2(dx), ry = side ? r2(dy) : (dy <= 0 ? -0.5 : 0.5);   // on the middle line: the top, where state variables usually sit   // the nearest point of its border
      var id = nodes2[i].id, j = svList(i).length;
      remember(false); text = sbJs.state(text, id, '', rx, ry); made(id);
      typeIn(id, j, true);
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
    function typeIn(id, j, merge) {   // merge: right after its making, the same undo step
      if (typing) typing.done(true);
      var i = nodes2.findIndex(function (n) { return n.id === id; });
      if (i < 0) return;
      var b = boxOf(i), sv = j == null ? null : svList(i)[j], at0 = j == null ? [b[0], b[1], b[2], b[3]] : [sv[1][0] - 40, sv[1][1] - 9, 80, 18];
      var inp = document.createElement('input'), before = j == null ? nameOf(i) : sv[0], step = undo.length, m0 = map;
      inp.type = 'text'; inp.className = 'm2-ed-type'; inp.value = before; inp.spellcheck = false;
      inp.setAttribute('aria-label', j == null ? 'Name' : 'State variable (value, or value@site)');
      inp.style.cssText = 'left:' + sx(at0[0]) + 'px;top:' + sy(at0[1]) + 'px;width:' + Math.max(60, at0[2] * V.z) + 'px;height:' + Math.max(20, at0[3] * V.z) + 'px;font-size:' + Math.max(11, Math.min(18, 14 * V.z)) + 'px';
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
          if (!(merge && undo.length === step)) remember(false);   // nothing done since its making: the same undo step (a shift out of negative places in the redraw is no step)
          text = t2; made(id);
        }, inp: inp
      };
      inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); typing && typing.done(true); V.view.focus({ preventScroll: true }); }
        else if (e.key === 'Escape') { e.preventDefault(); typing && typing.done(false); V.view.focus({ preventScroll: true }); }
      });
      inp.addEventListener('blur', function () { if (typing && typing.inp === inp) typing.done(true); });
      inp.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      setTimeout(function () { inp.focus(); inp.select(); }, 0);
    }
    // a double click on a named entity, or on one of its state variables, opens the box again
    V.view.addEventListener('dblclick', function (e) {
      if (!palOn() || !editing(e)) return;
      if (tool || Date.now() - placedAt < 600) { e.stopImmediatePropagation(); return; }   // the clicks of a placing: no zoom, no box again
      var base = src(), P = at(e), i = innermost(P, function (n) { return n.el.getAttribute('yfiles.foldertype') !== 'group' && sbJs.nameable(base, n.id); });
      var near0 = -1, best = 12 / Math.max(V.z, 0.2), res = svIcons();
      nodes2.forEach(function (n, k) {   // a state variable's circle, which may stand out of its node
        if (n.shape.kind !== 'Macromolecule') return;
        svList(k, res).forEach(function (q, j) { var d = Math.hypot(q[1][0] - P[0], q[1][1] - P[1]); if (d < Math.max(best, q[2][0] / 2)) { best = d; near0 = [k, j]; } });
      });
      if (near0 !== -1) { e.stopImmediatePropagation(); typeIn(nodes2[near0[0]].id, near0[1]); return; }
      if (i >= 0) { e.stopImmediatePropagation(); typeIn(nodes2[i].id, null); }
    }, true);
    ['wheel', 'gesturestart'].forEach(function (k) { V.view.addEventListener(k, function () { if (typing) typing.done(true); }, { capture: true, passive: true }); });   // the box would stand off its node after a zoom
    window.addEventListener('resize', function () { if (typing) typing.done(true); });
