    // ---------- the CellDesigner palette (editor/src/cdcreate.js) ----------
    // The CellDesigner palette, writing the CellDesigner file directly: on a CellDesigner map with Settings, Editing on Full, the Edit
    // window's palette offers CellDesigner's own set, SBGN-suited only: species, logic gates, reactions,
    // modifiers and, with the Reduced notation tick box, CellDesigner's reduced notation. The gestures are the SBGN
    // palette's (create.js): a click takes a sign once, a double click keeps it in hand, a sign dragged onto the map is put
    // where it is dropped; a drag from a node not selected draws a line, its kind guessed from its ends or the sign picked;
    // a gate takes three clicks (its inputs, then the reaction's square or the target entity; a NOT or unknown gate one
    // input), placed where CellDesigner puts it (cd_make.gate). Every change is written into the CellDesigner file by
    // cd_make (renderers/converter/cd_make.js, tests/cd-make.js), the editor's GraphML made again from it by cd_edit, so
    // the saved file opens in CellDesigner 4.4 as it was left; one undo step each (core.js keeps the file in the step).
    // the kinds are cd_make's (LOOK, PROCESS, MODS, REDUCED, NEED) and the gate signs cdrender's GATE, written here as
    // well because the palette is drawn before those files load; cdCheck() compares them once they have
    // each sign drawn as CellDesigner's own toolbar draws it, in the palette's weights (atlas-app.html, Sign weights); a
    // species' shape in the proportions CellDesigner gives it on the map where those cannot change (RNA's slant at 45 degrees)
    var CD_SP = [['PROTEIN', 'Protein', '<rect x="1.5" y="5" width="21" height="14" rx="3.5"/>'],
      ['GENE', 'Gene', '<rect x="1.5" y="6" width="21" height="12"/>'],
      ['RNA', 'RNA', '<path d="M11.5 7h11l-10 10h-11z"/>'],
      ['SIMPLE_MOLECULE', 'Simple molecule', '<circle cx="12" cy="12" r="7"/>'],
      ['UNKNOWN', 'Unknown', '<ellipse cx="12" cy="12" rx="10.5" ry="6" fill="currentColor" fill-opacity=".35" stroke="none"/>'],
      ['PHENOTYPE', 'Phenotype', '<path d="M6 5h12l4.5 7-4.5 7h-12l-4.5-7z"/>'],
      ['DEGRADED', 'Degraded', '<circle cx="12" cy="12" r="8"/><path d="M4 20l16-16"/>'],
      // the complex: its box with cut corners holding three overlapping members, each opaque over the one behind it
      ['COMPLEX', 'Complex', '<path d="M6 2.5h12l3.5 3.5v12l-3.5 3.5h-12l-3.5-3.5v-12z"/><g class="thin" fill="#fff"><rect x="8.5" y="5.5" width="7.5" height="6.5" rx="1"/><rect x="5" y="10" width="6.5" height="4.5" rx="1"/><ellipse cx="14.3" cy="14.8" rx="4.6" ry="3.6"/></g>'],
      ['COMPARTMENT', 'Compartment', '<rect x="1.5" y="3.5" width="21" height="17" rx="6"/><rect class="thin" x="4.5" y="6.5" width="15" height="11" rx="3.5"/>'],
      // CellDesigner's oval compartment (class OVAL), its two lines as the square one's
      ['OVAL', 'Oval compartment', '<ellipse cx="12" cy="12" rx="10.5" ry="8.5"/><ellipse class="thin" cx="12" cy="12" rx="7.5" ry="5.5"/>']];
    function cdComp(cls) { return cls === 'COMPARTMENT' || cls === 'OVAL'; }   // the two compartment kinds of the palette
    // gates: the circle with its sign, two input lines above and the output line below; the signs centred in the circle
    // (the bar and ! drawn, not letters, so they sit in its middle); the fourth item is cdrender's GATE sign, for cdCheck
    var CD_Q = '<path d="M9.8 10.2a2.2 2.2 0 1 1 3.2 2c-.7.4-1 .8-1 1.6" class="in"/><circle class="dot" cx="12" cy="16.4" r=".8"/>';
    var CD_GATES = [['AND', 'AND gate', '<text x="12" y="16.2" text-anchor="middle" font-size="9">&amp;</text>', '&amp;'], ['OR', 'OR gate', '<path d="M12 9.5v7" class="in"/>', '|'],
      ['NOT', 'NOT gate', '<path d="M12 9.6v4.6" class="in"/><circle class="dot" cx="12" cy="16.6" r=".8"/>', '!'], ['UNKNOWN', 'Unknown gate', '<g transform="translate(0 .7)">' + CD_Q + '</g>', '?']].map(function (q) {
      return [q[0], q[1], '<circle cx="12" cy="13" r="6.5"/><path d="M3 4l4.4 4.4M21 4l-4.4 4.4M12 19.5V23"/>' + q[2], q[3]];
    });
    // a reaction: the bare arrow with CellDesigner's filled head, the omitted one crossed by two slashes, the unknown one by ?
    var CD_LINE = '<path d="M1.5 12h15"/>', CD_HEAD = '<path d="M16 8.5l6.5 3.5-6.5 3.5z" fill="currentColor"/>';
    var CD_RX = [['STATE_TRANSITION', 'State transition', CD_LINE + CD_HEAD],
      ['KNOWN_TRANSITION_OMITTED', 'Known transition omitted', CD_LINE + '<path d="M6.5 16l2.5-8M10 16l2.5-8" class="in"/>' + CD_HEAD],
      ['UNKNOWN_TRANSITION', 'Unknown transition', CD_LINE + '<g transform="translate(-2.5 -1.5)">' + CD_Q + '</g>' + CD_HEAD]];
    // a modifier points down onto a reaction, as in CellDesigner's toolbar. The same signs draw reduced notation: with the
    // Reduced notation tick box ticked, a modifier's sign dragged from species to species makes CellDesigner's reduced
    // notation type for it (CD_RED), written as such in the file; catalysis has none in CellDesigner
    var CD_MOD = [['CATALYSIS', 'Catalysis', '<path d="M12 1.5v14"/><circle cx="12" cy="18.5" r="3"/>'],
      ['INHIBITION', 'Inhibition', '<path d="M12 1.5v19M7 20.5h10"/>'],
      ['PHYSICAL_STIMULATION', 'Physical stimulation', '<path d="M12 1.5v12.5M7.5 14h9l-4.5 7.5z"/>'],
      ['MODULATION', 'Modulation', '<path d="M12 1.5v11M12 12.5l3.5 4.5-3.5 4.5-3.5-4.5z"/>'],
      ['TRIGGER', 'Trigger', '<path d="M12 1.5v13.5M7 11.5h10M7.5 15h9l-4.5 7z"/>']].map(function (q) {
      return [q[0], q[1] + (q[0] === 'CATALYSIS' ? ' (onto a reaction)' : ' (onto a reaction, or between species with Reduced notation ticked)'), q[2]];
    });
    // reduced notation's types, each named as the modifier whose sign draws it (no positive influence: CellDesigner's open
    // arrowhead is not SBGN's, the file's taken in as the open triangle, cd_make sbgn)
    var CD_RED = [['NEGATIVE_INFLUENCE', 'INHIBITION'], ['REDUCED_PHYSICAL_STIMULATION', 'PHYSICAL_STIMULATION'], ['REDUCED_MODULATION', 'MODULATION'], ['REDUCED_TRIGGER', 'TRIGGER']];
    var RED_OF = {}; CD_RED.forEach(function (q) { RED_OF[q[1]] = q[0]; });   // a modifier's type -> its reduced notation type
    var CD_NAME = {};   // CellDesigner's names, for the menus and the status line (a gate's by G_ and its kind: UNKNOWN is a species too)
    CD_SP.concat(CD_RX, CD_MOD).forEach(function (q) { CD_NAME[q[0]] = q[1].replace(/ \(.*\)$/, ''); });
    CD_RED.forEach(function (q) { CD_NAME[q[0]] = CD_NAME[q[1]]; });
    CD_GATES.forEach(function (q) { CD_NAME['G_' + q[0]] = q[1]; });
    var cdK = function (q) { return ['cd:' + q[0], q[1], q[2]]; };   // the tool kinds, apart from the SBGN palette's
    function palCd() {   // the set: nodes, the gates, the lines last (as the SBGN palette); three blocks in the one list: species, gates, lines
      return [['Species', CD_SP.map(cdK)], ['Logic gates', CD_GATES.map(function (q) { return ['cd:G_' + q[0], q[1], q[2]]; }), true], ['Reactions', CD_RX.map(cdK), true], ['Modifiers', CD_MOD.map(cdK)]];
    }
    CD_RX.concat(CD_MOD).forEach(function (q) { ARCS['cd:' + q[0]] = 1; });   // the signs that draw a line (arcTool)
    var CD_GATE = {}; CD_GATES.forEach(function (q) { CD_GATE['cd:G_' + q[0]] = q[0]; });   // tool kind -> gate kind
    function cdKind(k) { return k && k.indexOf('cd:') === 0 ? k.slice(3) : null; }

    // the palette shown on a CellDesigner map (palShow, create.js)
    function cdPal() { return on && V.current === map && !!cd && !!cdJs && !!cdMk && V.level === 'full'; }
    var cdStrictMemo = [null, false];   // read from this browser once per map, not on every paint
    function cdStrict() {   // the Reduced notation tick box, per map as on SBGN-ML maps (unticked: no reduced notation)
      var id = palId();
      if (cdStrictMemo[0] !== id) { var k = palStore()[id]; cdStrictMemo = [id, !!(k && k.strict === true)]; }
      return cdStrictMemo[1];
    }
    function cdFill() {
      ['.m2-ed-pnot', '.m2-ed-plook', '.m2-ed-pprot'].forEach(function (c) { pal.querySelector(c).hidden = true; });   // no PD and AF on a CellDesigner map
      pal.querySelector('.m2-ed-pnot').style.display = 'none';   // a row: its display wins over hidden
      var hy = pal.querySelector('.m2-ed-pstrict'), hyc = hy.querySelector('input'), strict = cdStrict();
      hy.hidden = false;
      if (hyc.checked !== !strict) hyc.checked = !strict;
      cdInfo(hy, true);
      cdColsRow().hidden = false;
      var k = 'cd' + (strict ? 'S' : '') + (palGrouped() ? 'G' : '');
      if (palShown === k) return;
      palShown = k;
      palSignsEl.innerHTML = palSigns(palCd()); palBlocks();
    }
    // the tick box's title and circled i on a CellDesigner map say what it does there (the SBGN text speaks of
    // hybrid maps and SBGN-ML files); palFill puts the SBGN ones back
    var CD_INFO = 'Lets the modifiers\u2019 signs (inhibition, physical stimulation, modulation, trigger) join two species directly, written as CellDesigner\u2019s reduced notation, and allows a logic gate between species. Unticked: reactions and their modifiers only. CellDesigner\u2019s positive influence (an open arrowhead, not an SBGN sign) is made a physical stimulation when a map is opened.';
    function cdInfo(hy, on_) {
      var lab = hy.querySelector('label'), ti = hy.querySelector('.m2-ed-ptip'), tx = hy.querySelector('.m2-ed-ptext');
      if (!lab.dataset.sbgn) { lab.dataset.sbgn = lab.title; tx.dataset.sbgn = tx.textContent; }
      var v = on_ ? CD_INFO : tx.dataset.sbgn;
      if (tx.textContent !== v) { lab.title = on_ ? 'Ticked (the default): the reduced notation signs shown' : lab.dataset.sbgn; ti.title = v; tx.textContent = v; }
    }
    function cdCheck() {   // the palette's kinds against cd_make's and cdrender's, once loaded: a drift said in the console
      var g = window.cdrender && window.cdrender.GATE, miss = CD_SP.filter(function (q) { return !cdComp(q[0]) && !cdMk.LOOK[q[0]]; }).map(function (q) { return q[0]; })
        .concat(CD_RX.filter(function (q) { return cdMk.PROCESS.indexOf(q[0]) < 0; }).map(function (q) { return q[0]; }), CD_MOD.filter(function (q) { return cdMk.MODS.indexOf(q[0]) < 0; }).map(function (q) { return q[0]; }),
          CD_RED.filter(function (q) { return cdMk.REDUCED.indexOf(q[0]) < 0; }).map(function (q) { return q[0]; }), CD_GATES.filter(function (q) { return !cdMk.NEED[q[0]]; }).map(function (q) { return q[0]; }));
      if (miss.length) console.error('The CellDesigner palette offers kinds cd_make lacks: ' + miss.join(', '));
      if (g) CD_GATES.forEach(function (q) { var v = g[q[0]]; if (v && q[3] !== v) console.error('The palette\u2019s ' + q[1] + ' sign differs from cdrender\u2019s ' + v); });
    }
    pal.querySelector('.m2-ed-pstrict input').addEventListener('change', function (e) {   // on a CellDesigner map: kept per map, modifiers' signs between species allowed or not
      if (!cdPal()) return;
      var all = palStore(), id = palId();
      cdStrictMemo = [id, !e.target.checked];
      if (id) { all[id] = { lang: 'pd', look: 'rn', strict: !e.target.checked }; try { localStorage.setItem(PAL_KEY, JSON.stringify(all)); } catch (er) {} }
      palShown = null; palShow();
    });

    // a change made by the palette: the new CellDesigner text the file, the editor's GraphML made again from it, one undo
    // step; sel the node ids, selLines the line ids (a reaction's id: its main line) selected after it, either a function
    // giving them once fn has run
    function cdApply(fn, sel, selLines) {
      keyFlush();   // a run of arrow keys settled first (else a nudge then Delete within 150 ms loses the nudge)
      var now = lastFor && lastFor[0] === text ? cd.now : cdJs.draw(cd.base, text)[1];   // a move not drawn yet is in the file too
      var t2;
      try { t2 = fn(now); } catch (err) { warn(String(err && err.message || err).replace(/\.?$/, '.')); return false; }
      if (t2 && t2.text != null) t2 = t2.text;
      if (!t2 || t2 === now) return false;
      remember(false);
      cd.base = t2; text = cdGraphml(t2); parse();
      selN = []; selP = []; selE = []; part = null;
      if (typeof sel === 'function') sel = sel();
      if (typeof selLines === 'function') selLines = selLines();
      (sel || []).forEach(function (id) { nodes2.forEach(function (n, i) { if (n.id === id) selN.push(i); }); });
      (selLines || []).forEach(function (id) { edges2.forEach(function (q, k) { if (q.id === id || q.id === id + '|a' || q.id === id + '|b') selE.push(k); }); });
      dirty = true; quiet(); render(); paint(); changed();
      return true;
    }
    // what a node is on a CellDesigner map: 'epn' a species (not a complex's member), 'proc' a reaction's square, 'gate' a
    // gate, null a compartment or a member
    function cdRole(i) {
      var n = nodes2[i];
      if (/\|proc$/.test(n.id)) return 'proc';
      if (/\|g\d*$/.test(n.id)) return 'gate';
      if (n.comp || (n.up != null && !nodes2[n.up].comp)) return null;
      return 'epn';
    }
    function cdRid(i) { return nodes2[i].id.replace(/\|(proc|g\d*)$/, ''); }
    function cdGateRef(i) { var m = nodes2[i].id.match(/^(.*)\|g(\d*)$/); return m[2] ? m[1] + '|m' + m[2] : m[1]; }   // cd_make's name of a gate
    function cdComplexAt(P) { var i = innermost(P, function (n) { return n.shape.kind === 'Complex'; }); return i >= 0 ? nodes2[i].id : null; }   // the innermost complex under P, its alias

    // a species or compartment placed: centred where clicked or dropped (on the grid with Snap), at CellDesigner's own size
    // the colours of new species (the Colours line under the palette's tick box, kept in this browser for every
    // CellDesigner map): CellDesigner's own (cd_make LOOK, the default), the file's (the colour most species of the class
    // already have on the map, else CellDesigner's) or the viewer's Default scheme (Settings, Map colours) by the class's role
    var CD_COL_KEY = 'atlas-edit-cd-colours', CD_COLS = [['cd', 'CellDesigner', 'CellDesigner\u2019s own colours'], ['file', 'File', 'the colour most species of their class have on this map'], ['default', 'Default', 'the viewer\u2019s Default colours']];
    function cdCols() { var v = null; try { v = localStorage.getItem(CD_COL_KEY); } catch (e) {} return v === 'file' || v === 'default' ? v : 'cd'; }
    function cdColour(t, cls) { return cdColourIn(cdCols(), t, cls); }   // eight hex digits for cd_make, or null for CellDesigner's own
    function cdColourIn(m, t, cls) {
      if (m === 'file') return t ? cdMk.classColour(t, cls) : null;   // no file yet: the ghost before the map is loaded
      var c = m === 'default' && V.schemeFill && window.cdrender ? V.schemeFill('default', window.cdrender.ROLE[cls] || 'white') : null;
      return c ? 'ff' + c.toLowerCase() : null;
    }
    // the squares of a choice in the menu (the box shows its name only: bright colours there would draw the eye from the
    // map), five at most, the first at the right (row-reverse). CellDesigner and Default, fixed sets: the protein's, simple
    // molecule's, phenotype's, gene's and RNA's colours, each once. File: the five colours most species on the map have,
    // the most used first, from the map as it is now (classColours keeps its last answer)
    var CD_SQ = [['PROTEIN', 'protein'], ['SIMPLE_MOLECULE', 'simple molecule'], ['PHENOTYPE', 'phenotype'], ['GENE', 'gene'], ['RNA', 'RNA']];
    function cdSquares(mode) {
      var sq = function (x, t) { return '<i style="background:#' + x.slice(2) + '" title="' + t + '"></i>'; }, h;
      if (mode !== 'file') {
        var seen = {};
        h = CD_SQ.map(function (q) {
          var x = (mode === 'cd' ? null : cdColourIn(mode, null, q[0])) || cdMk.LOOK[q[0]][2];
          if (seen[x]) { seen[x].push(q[1]); return null; }
          seen[x] = [q[1]]; return x;
        }).filter(Boolean).map(function (x) { return sq(x, seen[x].join(', ') + ', #' + x.slice(2).toUpperCase()); }).join('');
      } else {
        var n = cd && cd.now ? cdMk.classColours(cd.now) : {}, w = {}, order = [];
        Object.keys(n).forEach(function (cls) { Object.keys(n[cls]).forEach(function (col) { if (!(col in w)) { w[col] = 0; order.push(col); } w[col] += n[cls][col]; }); });
        h = order.slice().sort(function (a, b) { return w[b] - w[a] || order.indexOf(a) - order.indexOf(b); }).slice(0, 5).map(function (x) { return sq(x, '#' + x.slice(2).toUpperCase() + ', ' + w[x] + ' species'); }).join('');
      }
      return '<span class="m2-cs-sw">' + h + '</span>';
    }
    function cdColsName(m) { return CD_COLS.filter(function (c) { return c[0] === m; })[0][1]; }
    var csMenu = null, csText = null;   // the menu open, the map's text it was made from
    function csClose() { if (csMenu) { csMenu.remove(); csMenu = null; var bx = pal.querySelector('.m2-cs-box'); if (bx) bx.setAttribute('aria-expanded', 'false'); } }
    // under the palette's signs, last (it needs little attention): the choice as a dropdown (the Grid size list's way,
    // core.js), 'Colour scheme: ' and its name in the box, the three in the menu by name, each with its squares
    function cdColsRow() {
      var r = pal.querySelector('.m2-ed-pcols');
      if (!r) {
        r = document.createElement('div'); r.className = 'm2-ed-pblk m2-ed-pcols';
        r.innerHTML = '<button type="button" class="m2-cs-box" title="Colours of new species" aria-label="Colours of new species" aria-haspopup="menu" aria-expanded="false"><span class="m2-cs-name"><span class="m2-cs-lab">Colour scheme: </span><span class="m2-cs-val"></span></span><svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>';
        var bx = r.firstChild;
        bx.addEventListener('click', function (e) {
          e.stopPropagation(); bx.blur();   // the editor's keys work at once
          if (csMenu) { csClose(); return; }
          var rc = bx.getBoundingClientRect(), m = cdCols();
          csMenu = document.createElement('div'); csMenu.className = 'm2-cx m2-cs-menu'; csMenu.setAttribute('role', 'menu'); csText = cd && cd.now; bx.setAttribute('aria-expanded', 'true');
          CD_COLS.forEach(function (c) {
            var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(c[0] === m));
            b.title = 'New species in ' + c[2];
            b.innerHTML = '<span>' + c[1] + '</span>' + cdSquares(c[0]);
            b.addEventListener('click', function (ev) {
              ev.stopPropagation(); csClose();
              try { if (c[0] === 'cd') localStorage.removeItem(CD_COL_KEY); else localStorage.setItem(CD_COL_KEY, c[0]); } catch (er) {}
              cdColsRow();
            });
            csMenu.appendChild(b);
          });
          document.body.appendChild(csMenu);
          var k = csMenu.getBoundingClientRect().width / csMenu.offsetWidth || 1;   // the page's own zoom: a fixed box is placed in its units
          var up = rc.bottom + 2 + csMenu.offsetHeight * k > window.innerHeight && rc.top - 2 - csMenu.offsetHeight * k > 0;   // above the box when it would leave the window below
          csMenu.style.left = rc.left / k + 'px'; csMenu.style.top = (up ? rc.top - 2 - csMenu.offsetHeight * k : rc.bottom + 2) / k + 'px'; csMenu.style.minWidth = rc.width / k + 'px';   // wider when five squares need it
        });
        document.addEventListener('pointerdown', function (e) { if (csMenu && !csMenu.contains(e.target) && !bx.contains(e.target)) csClose(); }, true);
        document.addEventListener('keydown', function (e) { if (csMenu && e.key === 'Escape') { e.stopPropagation(); csClose(); } }, true);   // Escape closes the menu only (not also the tool in hand)
        window.addEventListener('resize', csClose);
        document.addEventListener('scroll', function (e) { if (csMenu && !csMenu.contains(e.target)) csClose(); }, true);   // a fixed menu would stay where the box was
        pal.querySelector('.m2-ed-psigns').insertAdjacentElement('afterend', r);
      }
      if (csMenu && csText !== (cd && cd.now)) csClose();   // the map changed (an edit, an undo, another map): its squares would be stale
      var nm = r.querySelector('.m2-cs-val'), v = cdColsName(cdCols());
      if (nm.textContent !== v) nm.textContent = v;   // written only when changed (every paint comes here)
      return r;
    }
    function cdSize(cls) { return cdComp(cls) ? [300, 200] : cdMk.LOOK[cls].slice(0, 2); }
    function cdMake(P, kind) {
      var cls = cdKind(kind);
      if (!cls || CD_GATE[kind]) return;
      var s = cdSize(cls), X = P[0] - s[0] / 2, Y2 = P[1] - s[1] / 2;
      if (gridSet.snap) { X += toGrid(X + s[0] / 2, gridSet.step); Y2 += toGrid(Y2 + s[1] / 2, gridSet.step); }
      var b = [+fmt(Math.max(0, X)), +fmt(Math.max(0, Y2)), s[0], s[1]];   // never left of or above the canvas's corner (CellDesigner draws from 0, 0)
      // a species placed on a complex is its member (an included species, cd_make), the complex packed round it in the same
      // undo step; a phenotype or a degraded species not (CellDesigner keeps neither in a complex)
      var cx = !cdComp(cls) && !/^(PHENOTYPE|DEGRADED)$/.test(cls) ? cdComplexAt(P) : null, made = null;
      var ok = cdApply(function (t) {
        var r = cdComp(cls) ? cdMk.compartment(t, { name: '', box: b, oval: cls === 'OVAL' }) : cdMk.species(t, { cls: cls, name: '', box: b, complex: cx, colour: cdColour(t, cls) });
        made = r.alias; return r.text;
      }, function () { return [made]; });
      if (ok && cx) joinPack([cx]);
    }

    // a gate by three clicks: its inputs (two for AND and OR, one for NOT and the unknown gate), then
    // the reaction's square, or the target entity in reduced notation; the inputs marked as they are clicked
    var cdGate = null;   // { kind, inputs: [node ids] }
    function cdGateClick(P) {
      var kind = CD_GATE[tool.kind], i = linkEnd(P, -1), r = i >= 0 ? cdRole(i) : null;
      if (!cdGate || cdGate.kind !== kind) cdGate = { kind: kind, inputs: [] };
      var need = cdMk.NEED[kind], name = CD_NAME['G_' + kind];
      if (cdGate.inputs.length < need) {
        if (r !== 'epn') { warn(name + ': click ' + (cdGate.inputs.length ? 'its second input' : 'an input') + ', a species.'); return; }
        if (cdGate.inputs.indexOf(nodes2[i].id) >= 0) { warn(name + ': that species is an input already.'); return; }
        cdGate.inputs.push(nodes2[i].id);
        note(name + (cdGate.inputs.length < need ? ': now its second input.' : ': now the reaction’s square, or the target species (reduced notation).'));
        paint();
        return;
      }
      if (r !== 'proc' && r !== 'epn') { warn(name + ': click the reaction’s square, or the target species.'); return; }
      if (r === 'epn' && cdStrict()) { warn(name + ': a gate between species is reduced notation, unticked in the palette; click a reaction’s square.'); return; }
      var g = cdGate, target = r === 'proc' ? cdRid(i) : nodes2[i].id, out = null, L = cdGateLand(i, P) || {};   // where its line out lands, as shown
      // refused (the status line says why), the inputs clicked stay for another target
      if (!cdApply(function (t) { var q = cdMk.gate(t, { kind: g.kind, inputs: g.inputs, target: target, spot: L.spot, toAt: L.at }); out = q.gate; return q.text; },
        function () { return [/\|m\d+$/.test(out) ? out.replace(/\|m(\d+)$/, '|g$1') : out + '|g']; })) return;   // the gate selected: Delete takes it back
      cdGate = null;
      if (tool && !tool.sticky) palTake(null);
    }
    // Marks while a CellDesigner line is made, as CellDesigner shows them: what is picked (a gate's inputs clicked so far)
    // as selected, its outline and handles in magenta with a magenta dot at the port its line takes (the centre); the node
    // the next click or the line's end would land on with a dashed box, grey handles and a blue square at the port it
    // would take. In the map's units, so they follow the zoom as the other marks
    var cdHover = null;   // { id, P }: the node a gate's next click would take, under the pointer at P
    function cdHandles(i, cls) { return handleMarks(bx(i), cls); }
    function cdDot(Q, cls) { var d = Math.max(3, 4 * V.z); return '<rect class="' + cls + '" x="' + f1(sx(Q[0]) - d / 2) + '" y="' + f1(sy(Q[1]) - d / 2) + '" width="' + f1(d) + '" height="' + f1(d) + '"/>'; }
    function cdCentre(i) { var b = bx(i); return [b[0] + b[2] / 2, b[1] + b[3] / 2]; }
    function cdPicked(out, i) {   // a node picked: magenta outline, handles and the centre's dot
      out.push('<g transform="translate(' + f1(V.tx - x0 * V.z) + ',' + f1(V.ty - y0 * V.z) + ') scale(' + V.z + ')"><path class="m2-ed-pick" stroke-width="' + f1(1 / Math.max(V.z, 0.01)) + '" d="' + shapeD(i) + '"/></g>');
      out.push(cdHandles(i, 'm2-ed-pickh') + cdDot(cdCentre(i), 'm2-ed-pickh'));
    }
    function cdLand(out, i, Q) {   // the node a line would land on: dashed box, grey handles, the port it would take in blue
      var b = bx(i), off = 3.3 * V.z;
      out.push('<rect class="m2-ed-landbox" x="' + f1(sx(b[0]) - off) + '" y="' + f1(sy(b[1]) - off) + '" width="' + f1(b[2] * V.z + 2 * off) + '" height="' + f1(b[3] * V.z + 2 * off) + '"/>');
      out.push(cdHandles(i, 'm2-ed-landh') + cdDot(Q || cdCentre(i), 'm2-ed-port'));
    }
    function cdGateOk(i) {   // whether a gate's next click would take node i
      if (i < 0) return false;
      var r = cdRole(i), need = cdMk.NEED[CD_GATE[tool.kind]], got = cdGate && cdGate.kind === CD_GATE[tool.kind] ? cdGate.inputs : [];
      if (got.length < need) return r === 'epn' && got.indexOf(nodes2[i].id) < 0;
      return r === 'proc' || (r === 'epn' && !cdStrict());
    }
    function cdGateLand(i, P) {   // where the gate's line out lands on its target i: a reaction's square or a species' place
      var r = cdRole(i);
      return r === 'proc' ? cdPort(i, P, { mod: true }) : r === 'epn' ? cdPort(i, P, { red: true }) : null;
    }
    V.view.addEventListener('pointermove', function (e) {
      var on_ = cdPal() && tool && CD_GATE[tool.kind] && !e.buttons, P = on_ ? at(e) : null, i = on_ ? linkEnd(P, -1) : -1;
      if (on_ && !cdGateOk(i)) i = -1;
      var h = i >= 0 ? { id: nodes2[i].id, P: P } : null, was = cdHover;   // by id: a re-parse (an undo, the gate made) renumbers nodes2
      cdHover = h;
      var q = function (x) { if (!x) return ''; var k = nodes2.findIndex(function (n) { return n.id === x.id; }), L = k >= 0 && cdGateLand0(k, x.P); return x.id + (L ? (L.at || '') + (L.spot || '') : ''); };
      if (q(was) !== q(h)) paint();   // only when the node or its blue place changes
    });
    function cdGateLand0(k, P) { var need = cdMk.NEED[CD_GATE[tool.kind]], got = cdGate && cdGate.kind === CD_GATE[tool.kind] ? cdGate.inputs.length : 0; return got >= need ? cdGateLand(k, P) : null; }
    V.view.addEventListener('pointerleave', function () { if (cdHover) { cdHover = null; paint(); } });
    function cdGateMarks(out) {   // a gate being made by clicks (paint, core.js through linkPaint): its inputs picked, the next click's node
      if (!tool || !CD_GATE[tool.kind] || !cdPal()) { cdGate = null; cdHover = null; return; }
      if (cdGate && CD_GATE[tool.kind] !== cdGate.kind) cdGate = null;
      if (cdGate) cdGate.inputs.forEach(function (id) { var i = nodes2.findIndex(function (n) { return n.id === id; }); if (i >= 0) cdPicked(out, i); });
      var k = cdHover ? nodes2.findIndex(function (n) { return n.id === cdHover.id; }) : -1;
      if (k >= 0 && cdGateOk(k)) { var L = cdGateLand0(k, cdHover.P); cdLand(out, k, L && L.Q); }
    }
    function cdLinkMarks(out) {   // a line drawn by a drag on a CellDesigner map: its start picked, the node it would land on
      cdPicked(out, link.from);
      if (link.to >= 0 && link.how && !link.how.no) cdLand(out, link.to, link.how.land && link.how.land.Q);
    }
    // the map clicked with a CellDesigner sign in hand (palUp, create.js)
    function cdClick(P) { if (CD_GATE[tool.kind]) cdGateClick(P); else cdMake(P, tool.kind); }

    // a line drawn by a drag (create.js linkHow, linkMake). With no sign picked: species to species a state transition;
    // a species onto a reaction's square a catalysis; a square to a species an added product; a species onto a gate a new
    // input. A reaction sign picked: species to species that reaction, a species onto a square an added reactant. A
    // modifier picked: a species onto a square, or species to species its reduced notation type (the tick box ticked)
    // what a line from a to b makes (cdHow0), with where its end would land when let go at P (land: { Q, at, spot },
    // shown by cdLand and written by cdLink)
    function cdHow(a, b, P) { var h = cdHow0(a, b); if (h && !h.no && P) h.land = cdPort(b, P, h); return h; }
    // where an end let go at P lands on node i. A species, for a reaction's or reduced line's product end or an added
    // product: one of CellDesigner's 16 places (cdrender anchorAt, its one master), the nearest to P, or the centre while
    // P is in the middle half of the box. A reaction's square, for a modifier: the nearest of its six places, turned with
    // the main line (cdrender SQUARE's order, 2 to 7). Anything else: the centre
    var cdClsMemo = [null, {}];
    function cdClsOf(id) {
      if (cdClsMemo[0] !== cd.now) cdClsMemo = [cd.now, {}];
      if (!(id in cdClsMemo[1])) { try { var A = cdMk.aliasInfo(cd.now, id); cdClsMemo[1][id] = A.cls && [A.cls, A.homodimer || 1]; } catch (e) { cdClsMemo[1][id] = null; } }
      return cdClsMemo[1][id];
    }
    function cdPort(i, P, how) {
      var b = bx(i), C = [b[0] + b[2] / 2, b[1] + b[3] / 2], best = null, bd = Infinity;
      var near = function (Q, o) { var d = Math.hypot(Q[0] - P[0], Q[1] - P[1]); if (d < bd) { bd = d; best = o; o.Q = Q; } };
      if (how.mod && cdRole(i) === 'proc') {   // procPlaces (core.js): the six places in cdrender SQUARE's order, 2 to 7
        var S = procPlaces(i);
        if (!S) return { Q: C };
        S.forEach(function (o, k) { near([C[0] + o[0], C[1] + o[1]], { spot: k + 2 }); });
        return best;
      }
      var cl = (how.rx || how.red || how.part === 'product') && cdRole(i) === 'epn' && window.cdrender && window.cdrender.anchorAt ? cdClsOf(nodes2[i].id) : null;
      if (!cl || Math.max(Math.abs(P[0] - C[0]) / (b[2] / 2 || 1), Math.abs(P[1] - C[1]) / (b[3] / 2 || 1)) < 0.5) return { Q: C };
      var f = window.cdrender.frontBox(b, cl[1]);   // a multimer's places on its front copy, as cdrender draws the line (D.front)
      Object.keys(window.cdrender.ANCHOR).forEach(function (k) { near(window.cdrender.anchorAt(cl[0], f, k), { at: k }); });
      return best;
    }
    function cdHow0(a, b) {
      if (b < 0) return null;
      var ra = cdRole(a), rb = cdRole(b), want = tool && ARCS[tool.kind] ? cdKind(tool.kind) : null;
      var isRx = want && CD_RX.some(function (q) { return q[0] === want; }), isMod = want && cdMk.MODS.indexOf(want) >= 0;
      if (!rb) return { no: 'A line joins species, a reaction’s square or a logic gate: never a compartment or a complex’s member.' };
      if (ra === 'gate') return { no: 'A logic gate has one line out, made with the gate.' };
      if (rb === 'gate') {
        if (ra !== 'epn') return { no: 'A logic gate’s inputs are species.' };
        return want ? { no: 'A line onto a logic gate adds an input: no sign picked.' } : { gate: true };
      }
      if (ra === 'proc' && rb === 'proc') return { no: 'A line does not join two reactions.' };
      if (ra === 'proc') return isMod ? { no: 'A ' + CD_NAME[want].toLowerCase() + ' goes from a species.' } : { part: 'product' };
      if (rb === 'proc') {
        return isRx ? { part: 'reactant' } : { mod: want || 'CATALYSIS' };
      }
      if (isMod) {   // between species: its reduced notation type, with the tick box ticked
        if (!RED_OF[want]) return { no: 'CellDesigner has no catalysis between species: it ends on a reaction’s square (between species, physical stimulation).' };
        return cdStrict() ? { no: 'A ' + CD_NAME[want].toLowerCase() + ' between species is reduced notation, unticked in the palette; it ends on a reaction’s square.' } : { red: RED_OF[want] };
      }
      return { rx: want || 'STATE_TRANSITION' };
    }
    function cdLink(a, b, how) {
      var ia = nodes2[a].id, ib = nodes2[b].id, line = null;
      cdApply(function (t) {
        var q;
        var L = how.land || {};   // where its end lands (cdPort)
        if (how.rx) { q = cdMk.reaction(t, { type: how.rx, from: ia, to: ib, toAt: L.at }); line = q.reaction; }
        else if (how.red) { q = cdMk.reduced(t, { type: how.red, from: ia, to: ib, toAt: L.at }); line = q.reaction; }
        else if (how.gate) q = cdMk.gateInput(t, cdGateRef(b), ia);
        else if (how.mod) { q = cdMk.modifier(t, cdRid(b), ia, how.mod, L.spot); line = cdRid(b) + '|' + q.part; }
        else { q = how.part === 'reactant' ? cdMk.reactant(t, cdRid(b), ia) : cdMk.product(t, cdRid(a), ib, L.at); line = cdRid(how.part === 'reactant' ? b : a) + '|' + q.part; }
        return q.text;
      }, [], function () { return line ? [line] : []; });   // the new line selected: Delete takes it back
    }

    // Delete (the key, or the right-click menu): species and compartments selected with all that hangs on them
    // (cd_make.remove: a compartment only empty), reactions by their square or main line, a modifier, added reactant or
    // product, a gate with its lines, a gate's input
    // Each thing is named by what it is, not by its number (removing a gate or its last input renumbers a reaction's
    // modifications): read again before each removal, and one gone with an earlier one skipped
    function cdDelete(nodes, lines) {
      var al = [], jobs = [], ab = function (t, rid) { try { return cdMk.about(t, rid); } catch (e) { return null; } };
      var seen = {}, job = function (j) { var k = JSON.stringify(j); if (!seen[k]) { seen[k] = 1; jobs.push(j); } };
      var t0 = cd.now;
      nodes.forEach(function (i) {
        var r = cdRole(i), rid = r ? cdRid(i) : null;
        if (r === 'proc') job({ rid: rid });
        else if (r === 'gate') {
          var m = nodes2[i].id.match(/\|g(\d+)$/), A = ab(t0, rid);
          if (!m) job({ rid: rid });   // a gate between species is its reaction
          else if (A) job({ rid: rid, mod: A.mods[+m[1]], al: A.modAliases[+m[1]] });
        } else al.push(nodes2[i].id);   // a member or a compartment too: cd_make says what it refuses
      });
      lines.forEach(function (k) {
        var e = edges2[k], m = e.id.match(/^(.*)\|(a|b|[rpmi])(\d*)$/);
        if (!m) return;
        var rid = m[1], A = ab(t0, rid);
        if (m[2] === 'a' || m[2] === 'b') job({ rid: rid });
        else if (m[2] === 'i') job({ rid: rid, input: nodes2[e.s].id });
        else if (m[2] === 'm' && A) job({ rid: rid, mod: A.mods[+m[3]], al: A.modAliases[+m[3]] });
        else if (A) job({ rid: rid, link: m[2], al: (m[2] === 'r' ? A.rl : A.pl)[+m[3]] });
      });
      if (!al.length && !jobs.length) return false;
      cdApply(function (t) {
        jobs.forEach(function (j) {
          var A = ab(t, j.rid);
          if (!A) return;   // gone with something removed before
          if (j.input) { if (A.inputs && A.inputs.indexOf(j.input) >= 0) t = cdMk.gateInputRemove(t, j.rid, j.input); return; }
          if (j.mod) { var n = A.mods.findIndex(function (x, q) { return x === j.mod && A.modAliases[q] === j.al; }); if (n >= 0) t = cdMk.removeLine(t, j.rid, 'm' + n); return; }
          if (j.link) { var l = (j.link === 'r' ? A.rl : A.pl).indexOf(j.al); if (l >= 0) t = cdMk.removeLine(t, j.rid, j.link + l); return; }
          t = cdMk.removeLine(t, j.rid);
        });
        if (al.length) t = cdMk.remove(t, al);
        return t;
      });
      return true;
    }
    document.addEventListener('keydown', function (e) {
      if ((e.key !== 'Delete' && e.key !== 'Backspace') || !cdPal() || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if ((selN.length || selE.length) && !selP.length && cdDelete(selN, selE)) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    function cdDeleteItem() {   // the right-click menu's Delete over a node or a line
      if (!rclick) return null;
      var h = hit(rclick);
      if (h && h.n != null) { var i = h.n; return function () { cdDelete(selN.indexOf(i) >= 0 ? selN : [i], selN.indexOf(i) >= 0 ? selE : []); }; }
      if (h && h.e != null && h.p == null) { var k = h.e; return function () { cdDelete([], selE.indexOf(k) >= 0 ? selE : [k]); }; }
      return null;
    }
    // the right-click menu over a species, a line or a gate: its other kinds within the palette's
    function cdItems() {
      if (!rclick) return null;
      var h = hit(rclick), out = [];
      if (h && h.n != null) {
        var i = h.n, r = cdRole(i), id = nodes2[i].id;
        if (r === 'gate') {
          var g = cdMk.about(cd.now, cdRid(i)), m = id.match(/\|g(\d+)$/), now = m ? g.gates[+m[1]] : g.gate;
          if (!now) return null;
          var nin = m ? now.inputs.length : (g.inputs || []).length;
          CD_GATES.forEach(function (q) {
            if (q[0] !== now.kind && !(q[0] === 'NOT' && nin > 1) && nin >= cdMk.NEED[q[0]]) out.push(['Make ' + q[1], function () { cdApply(function (t) { return cdMk.gateType(t, cdGateRef(i), { kind: q[0] }); }, [id]); }]);
          });
          return out;
        }
        if (r === 'proc') return cdRxItems(cdRid(i));
        var A = cdMk.aliasInfo(cd.now, id);
        if (!A.cls || A.cls === 'COMPLEX') return null;
        CD_SP.forEach(function (q) {
          if (q[0] !== A.cls && q[0] !== 'COMPLEX' && !cdComp(q[0])) out.push(['Make ' + q[1].toLowerCase(), function () { cdApply(function (t) { return cdMk.retype(t, id, q[0], { from: cdColour(t, A.cls), to: cdColour(t, q[0]) }); }, [id]); }]);
        });
        return out;
      }
      if (h && h.e != null && h.p == null) {
        var ln = edges2[h.e], mm = ln.id.match(/^(.*)\|(a|b|m\d+)$/);
        if (!mm || (ln.t != null && cdRole(ln.t) === 'gate')) return null;   // a gate's input: nothing to change on it
        if (ln.s != null && cdRole(ln.s) === 'gate') {   // a gate's line out: its other output types (a modifier's on a reaction, reduced notation's between species)
          var gs = ln.s, gref = cdGateRef(gs), ga = cdMk.about(cd.now, cdRid(gs)), gm = nodes2[gs].id.match(/\|g(\d+)$/), gw = gm ? ga.gates[+gm[1]] : ga.gate;
          if (!gw) return null;
          return (gm ? CD_MOD : CD_RED).filter(function (q) { return q[0] !== gw.out; }).map(function (q) {
            return ['Make ' + CD_NAME[q[0]].toLowerCase(), function () { cdApply(function (t) { return cdMk.gateType(t, gref, { output: q[0] }); }, [nodes2[gs].id]); }];
          });
        }
        if (mm[2][0] !== 'm') return cdRxItems(mm[1]);
        var n = +mm[2].slice(1), ab = cdMk.about(cd.now, mm[1]), was = ab.mods[n];
        if (cdMk.MODS.indexOf(was) < 0) return null;   // a gate's own line: its gate's menu
        return CD_MOD.filter(function (q) { return q[0] !== was; }).map(function (q) {
          return ['Make ' + CD_NAME[q[0]].toLowerCase(), function () { cdApply(function (t) { return cdMk.modifierType(t, mm[1], n, q[0]); }, [], [mm[1] + '|m' + n]); }];
        });
      }
      return null;
    }
    function cdRxItems(rid) {   // a reaction's other types: a process's among the three, reduced notation's among its four
      var ab = cdMk.about(cd.now, rid), set = cdMk.PROCESS.indexOf(ab.type) >= 0 ? CD_RX : cdMk.REDUCED.indexOf(ab.type) >= 0 ? CD_RED : null;
      if (!set) return null;
      return set.filter(function (q) { return q[0] !== ab.type; }).map(function (q) {
        return ['Make ' + CD_NAME[q[0]].toLowerCase(), function () { cdApply(function (t) { return cdMk.reactionType(t, rid, q[0]); }, [], [rid]); }];
      });
    }
    // a name typed in place (a double click on a species or a compartment's top band, typeIn in create.js), written by
    // cd_make.rename; a degraded species has none
    V.view.addEventListener('dblclick', function (e) {
      if (!cdPal() || !editing(e)) return;
      if (tool || Date.now() - placedAt < 600) { e.stopImmediatePropagation(); return; }
      var P = at(e), i = innermost(P, function (n, k) { return cdRole(k) === 'epn' && (n.el.getAttribute('yfiles.foldertype') !== 'group' || P[1] - boxOf(k)[1] >= boxOf(k)[3] - 24) || (n.comp && P[1] - boxOf(k)[1] <= 24); });
      if (i < 0) return;
      var A = cdMk.aliasInfo(cd.now, nodes2[i].id);
      if (A.cls === 'DEGRADED') return;
      e.stopImmediatePropagation(); typeIn(nodes2[i].id, null);
    }, true);
    // the name as typed: CellDesigner's file keeps it escaped, a line break as _br_ and Greek letters spelled (cd_make.cdName);
    // a species not named yet carries its id (CellDesigner's way), shown as no name
    function cdNameOf(id) {
      var A = cdMk.aliasInfo(cd.now, id), s = A.name || '';
      if (s === A.id) return '';
      s = s.replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCodePoint(parseInt(h, 16)); }).replace(/&#(\d+);/g, function (m, d) { return String.fromCodePoint(+d); })
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      return window.cdrender.plainName(s).replace(/_br_/g, ' ');
    }
    function cdRename(id, v) { cdApply(function (t) { return cdMk.rename(t, id, v); }, [id]); }

    // resizing and Properties on a CellDesigner map (propFmt, create.js): a species not in a complex, a complex aside (its
    // members set its size), resized by its handles or by Width and Height, as on SBGN-ML maps; the label, the fill, the
    // border width and multimer (the species' homodimer, 2 when ticked) written by cd_make. No border colour (CellDesigner's
    // species have none); a degraded species keeps its look and its id as its name. Set as default not yet: the colours of
    // new species come from the palette's list
    function cdSpecies(i) { return cdRole(i) === 'epn' && nodes2[i].el.getAttribute('yfiles.foldertype') !== 'group'; }
    function cdSetSize(i, nb) {   // node i given the box nb, one undo step with the compartments round it grown to hold it (written back by cd_edit)
      var id = nodes2[i].id, was = boxOf(i), one = {};
      if (nb.every(function (v, j) { return Math.abs(v - was[j]) < 0.005; })) { liveOff(); sizeOff(); paint(); return; }
      remember(false); one[i] = nb; setBoxes(one);
      var k0 = nodes2.findIndex(function (n) { return n.id === id; });
      setBoxes(grown([k0], boxOf, function (k) { return k === k0 ? was : boxOf(k); }, function () { return false; }));
      selN = []; nodes2.forEach(function (n, k) { if (n.id === id) selN = [k]; });
      sizeRec = null; render(); paint(); changed();
    }
    var cdLook = [];   // [alias id, file, its look]
    var PF_CD = { sizable: cdSpecies, size: cdSetSize, def: false,
      node: function (i) { return cdSpecies(i) ? i : -1; },
      off: function (k, i) { return k === 'line' || (/^(label|fill|multimer)$/.test(k) && pNow.cls === 'DEGRADED'); },   // pNow: look's, read just before
      look: function (i) {   // null while the file is behind the map read (an undo not drawn yet); read once per node and file (it runs with every paint)
        var id = nodes2[i].id;
        if (cdLook[0] !== id || cdLook[1] !== cd.now) {
          var L = null;
          try { L = cdMk.look(cd.now, id); L = { label: cdNameOf(id), fill: L.fill, line: '#000000', width: L.width, multimer: L.multimer, cls: L.cls }; } catch (e) { L = null; }
          cdLook = [id, cd.now, L];
        }
        return cdLook[2] && Object.assign({}, cdLook[2]);
      },
      set: function (k, v, i) {
        var id = nodes2[i].id;
        if (k === 'label') return cdApply(function (t) { return cdMk.rename(t, id, v.replace(/[\r\n]+/g, ' ')); }, [id]);
        if (k === 'multimer') return cdApply(function (t) { return cdMk.homodimer(t, id, v ? 2 : 1); }, [id]);
        if (k === 'width') { var x = parseFloat(v); return x > 0 && x <= 20 && cdApply(function (t) { return cdMk.restyle(t, id, { width: x }); }, [id]); }
        if (k === 'fill') { var c = hex(v); return !!c && cdApply(function (t) { return cdMk.restyle(t, id, { fill: c }); }, [id]); }
        return false;
      } };

    // a sign dragged from the palette: CellDesigner's shape at its size following the pointer (create.js palDrag), drawn
    // as cdrender draws it once dropped (D.shape, outline: RNA slanted by its height, a protein's corners 5, a complex's
    // cut 5, a degraded circle 3/8 of the width with its stroke), so nothing changes shape on the drop
    function cdGhost(kind) {
      var cls = cdKind(kind), s = cdSize(cls), w = s[0], h = s[1], col = cdComp(cls) ? 'none' : '#' + (cdColour(cd && cd.now, cls) || cdMk.LOOK[cls][2]).slice(2), ink = ' fill="' + col + '" stroke="#000" stroke-width="1"';
      var shape = {
        PROTEIN: '<rect width="' + w + '" height="' + h + '" rx="5"' + ink + '/>', GENE: '<rect width="' + w + '" height="' + h + '"' + ink + '/>',
        RNA: '<path d="M' + h + ' 0H' + w + 'L' + (w - h) + ' ' + h + 'H0z"' + ink + '/>', SIMPLE_MOLECULE: '<ellipse cx="' + w / 2 + '" cy="' + h / 2 + '" rx="' + w / 2 + '" ry="' + h / 2 + '"' + ink + '/>',
        UNKNOWN: '<ellipse cx="' + w / 2 + '" cy="' + h / 2 + '" rx="' + w / 2 + '" ry="' + h / 2 + '" fill="' + col + '"/>',
        PHENOTYPE: '<path d="M' + h / 2 + ' 0H' + (w - h / 2) + 'L' + w + ' ' + h / 2 + 'L' + (w - h / 2) + ' ' + h + 'H' + h / 2 + 'L0 ' + h / 2 + 'z"' + ink + '/>',
        DEGRADED: '<circle cx="' + w / 2 + '" cy="' + h / 2 + '" r="' + w * 3 / 8 + '"' + ink + '/><path d="M' + w * 0.7 + ' 0L' + w * 0.3 + ' ' + h + '" stroke="#000"/>',
        COMPLEX: '<path d="M5 0H' + (w - 5) + 'L' + w + ' 5V' + (h - 5) + 'L' + (w - 5) + ' ' + h + 'H5L0 ' + (h - 5) + 'V5z"' + ink + ' stroke-width="2"/>',
        COMPARTMENT: '<rect width="' + w + '" height="' + h + '" rx="10" fill="none" stroke="#000" stroke-width="2"/><rect x="6" y="6" width="' + (w - 12) + '" height="' + (h - 12) + '" rx="6" fill="none" stroke="#000"/>',
        OVAL: '<ellipse cx="' + w / 2 + '" cy="' + h / 2 + '" rx="' + w / 2 + '" ry="' + h / 2 + '" fill="none" stroke="#000" stroke-width="2"/><ellipse cx="' + w / 2 + '" cy="' + h / 2 + '" rx="' + (w / 2 - 6) + '" ry="' + (h / 2 - 6) + '" fill="none" stroke="#000"/>'
      }[cls];
      return { w: w, h: h, svg: '<svg width="100%" height="100%" viewBox="0 0 ' + w + ' ' + h + '" overflow="visible">' + shape + '</svg>' };
    }
