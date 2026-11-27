import { shared, V } from './state.js';
import { boxOf, commit, edges2, fmt, grown, map, nodes2, on, paint, parse, realizerOf, refit, render, setBoxes, setText, src, warn } from './core.js';
import { sbJs } from './engines.js';
import { sbClasses, sbKind } from './sbgn.js';
import { annItem, colsPick, confettiLine, confettiOne, confettiPick, confettiSquares, DEF_KEY, defOf, defsKept, EXTRA, field, freeId, hasMulti, hex, HUB_KINDS, idOwn, isMade, keepLook, keepMapChoice, keepSel, lookKey, mapCols, nameOf, origAll, palDrop, palId, propNode, propNodes, props, stdLetters, stdScale, styleRow, SV, svAddTo, svClash, svHold, svIconsOn, svIdx, svList, svOnly, svPt, svR, svSettle, svTwin, svVar, tagTurnT, termScaled, termsFix, UI } from './create.js';
import { liveOff, sizeOff } from './live.js';

    // ---------- the SBGN-ML palette's own part (editor/src/sbcreate.js) ----------
    // What the palette (create.js) asks of an SBGN-ML map, as it asks a CellDesigner map's of cdcreate.js: whether the
    // SBGN-ML palette is on, what the map is (PD, AF, hybrid, empty) and what its file starts as; Properties of an
    // SBGN-ML glyph or line (PF_SB, beside cdcreate.js's PF_CD), with the process and gate buttons. create.js holds the
    // palette's gestures and rows for every format with a palette; the answers that read an SBGN-ML file live here.

    var TAGS, sbRxSeen, sbCountMemo, antMemo, cardMemo, PF_SB;
    function __run1() {   // run at start, in order (__start)
    TAGS = /^(tag|terminal)$/;   // a tag's rows: Label, Font size, Width, Height, Fill colour, Border colour, Border width, Orientation (a terminal's shown, set by its side)
    sbRxSeen = [null, null];
    sbCountMemo = [null, null, null];   // [line id, text, its cardinality]: read once per line and text (Properties runs with every paint)
    antMemo = [null, {}];   // a process's or gate's antennas, read once per text (sbAnts)
    cardMemo = [null, null];   // [text, the cardinalities' boxes by line id] (cardAll)
    // Properties of an SBGN-ML glyph or line, as PF_CD is a CellDesigner map's (create.js propFmt)
    PF_SB = { sizable: sbSizable, size: sbSetSize, node: sbNode, set: sbSet, def: sbDef, ends: sbEnds, hub: function (i) { return !!hubGroup(i); },
      rx: { of: sbRxOf, set: function (pid, on) { return sbReversible(pid, on, true); }, withNode: true },
      refs: { of: sbRefsOf, set: sbRefsSet },   // a process's references (Properties, References)
      ids: { of: sbIdsOf, set: sbIdsSet },   // an entity's or a compartment's identifiers (Properties, Identifiers)
      line: { colour: sbLineColour, set: sbLineSet, width: function (k) { return sbJs.widthOf(sbEdgeEl(k)); }, setWidth: sbLineWidth, ports: true,   // a line's colour, width and its ports' rows (edgeShow, edgeSet)
        count: sbCount, setCount: function (k, v) { return sbLineTo(k, sbJs.recount(shared.text, edges2[k].id, v)); } },   // a consumption's or production's cardinality
      off: sbOff,
      look: function (i) {
        var r = realizerOf(nodes2[i].el), o = sbJs.lookOf(r), wf = field('way');
        if (wf) { wf.disabled = nodes2[i].sub != null; wf.title = wf.disabled ? 'A terminal points into its submap, set by the side it sits on' : ''; }
        var an = hubGroup(i) ? sbAnts()[nodes2[i].id] : null;   // read only for a process or gate (every antenna in one reading of the text)
        return { label: nameOf(i), font: o.font, fill: o.fill ? o.fill.slice(0, 7).toLowerCase() : '', line: (o.line || '#000000').slice(0, 7).toLowerCase(), width: o.width, multimer: o.multimer, way: (sbJs.wayOfR && sbJs.wayOfR(r)) || 'right', ant: an == null ? '' : an };
      } };
    }
    // the SBGN-ML palette on: an SBGN-ML map in Full editing (a CellDesigner map's: cdPal, cdcreate.js)
    function palOn() { return on && V.current === map && !!shared.sb && !!sbJs && V.level === 'full'; }
    // what the map is, read from its file as it is now: sbgn_edit.mapKind, the one
    // master write() also decides by (empty, pd, hybrid, af), the file turned to it as it changes; read once per change of
    // the editor's GraphML (sbKind, sbgn.js), never for a paint
    function palKind() { return sbKind(); }
    // the map itself Activity Flow (palKind), whichever palette is chosen: what a glyph's right-click menu offers and whether
    // its state variables are picked follow the map, never the tab (else the AF tab would take them from a PD map)
    function afKind() { return !!shared.sb && palKind() === 'af'; }
    // the activities of a hybrid SBGN-ML map (PD with activities), whose units of information are kept as on an AF map
    // (create.js svAt); null on any other map
    function hybridActs() { return shared.sb && palKind() === 'hybrid' ? sbJs.activities(shared.text) : null; }
    // a state variable or unit of information deleted from an SBGN-ML glyph (create.js svDelete; a CellDesigner map's goes
    // through F.sv): its copies' twins too, one undo step
    function svDeleteSb(i) {
      var q = svList(i)[shared.svSel.j];
      var share = q[3] === SV ? svShareMove(i, q, svR(i, q), null) : null;   // the copies too
      var sid = shared.svSel.id;
      if (!commit((q[3] === UI ? sbJs.unitDelete : sbJs.stateDelete)(shared.text, sid, q[4], { sbgn: shared.sb.base }), { name: 'state variable deleted', ids: [sid], then: function () { shared.svSel = null; if (share) share(); } })) { shared.svSel = null; render(); paint(); }
      return true;
    }
    // an SBGN-ML file that is Activity Flow as it was opened (the palette's start when the map has no choice kept)
    function sbFileAf() { return !!shared.sb && sbJs.isAf(shared.sb.base); }
    function sbSizable(i) {   // a glyph made from the palette, a complex's member too (the complex grows round it), a compartment
      var n = nodes2[i];
      return !!n.comp || isMade(n);   // a compartment too (holderSize); a process or gate too, its antennas kept as long (sbgn_edit.resize)
    }
    function sbSetSize(pairs) {   // each node given its box, one undo step with the compartments round them grown to hold them
      var ids = [], was = {}, t2 = shared.text, tids = [];   // tids: the terminals of a submap resized, kept on its sides (termsFix)
      pairs.forEach(function (q) {
        var b0 = boxOf(q[0]), b1 = q[1];
        nodes2.forEach(function (n, k) {
          if (n.sub !== q[0]) return;
          t2 = sbJs.resize(t2, n.id, termScaled(boxOf(k), b0, b1));
          tids.push(n.id);
        });
      });
      try { pairs.forEach(function (q) { var id = nodes2[q[0]].id; ids.push(id); was[id] = boxOf(q[0]); t2 = sbJs.resize(t2, id, q[1]); }); }
      catch (err) { warn('Not resized: ' + (err && err.message || err) + '.'); liveOff(); sizeOff(); paint(); return; }
      if (t2 === shared.text) { liveOff(); sizeOff(); paint(); return; }
      commit(t2, { name: 'resized', ids: ids, then: function () {
      nodes2.forEach(function (n) { if (n.sub != null && ids.indexOf(n.id) >= 0) tids.push(n.id); });   // a terminal resized itself: kept on its side
      if (tids.length) termsFix(nodes2.map(function (n, k) { return tids.indexOf(n.id) >= 0 ? k : -1; }).filter(function (k) { return k >= 0; }), true);
      shared.selN = []; nodes2.forEach(function (n, k) { if (ids.indexOf(n.id) >= 0) shared.selN.push(k); });
      var ks = shared.selN.slice();   // their holders grown round them as round a drag (grown)
      if (ks.length) setBoxes(grown(ks, boxOf, function (k) { return was[nodes2[k].id] || boxOf(k); }, function () { return false; }));
      refit(ids);
      shared.sizeRec = null;
      } });
    }
    function sbNode(i) {   // a glyph Properties restyles (sbgn_edit LOOKS: entities, complexes, compartments, processes, gates, tags and terminals; its class read from the file once per selection and change)
      return sbJs.LOOKS.test(sbClasses()[nodes2[i].id] || '') ? i : -1;
    }
    function sbOff(k, i) {
      var c = sbClasses()[nodes2[i].id] || '';
      if (k === 'way') return !TAGS.test(c);
      if (TAGS.test(c)) return !/^(label|font|w|h|fill|line|width)$/.test(k);   // Font size as every named glyph (NAMED has tag and terminal)
      if (k === 'label' || k === 'font') return !sbJs.NAMED.test(c);   // a font size where there is a name
      if (k === 'multimer') return !hasMulti(c.replace(/ multimer$/, ''));
      if (k === 'ant') return !hubGroup(i) || sbAnts()[nodes2[i].id] == null;   // a process's or gate's antenna, once it has ports
      if (EXTRA.indexOf(k) >= 0) return true;   // another format's own rows (propRows)
      if (k === 'def') return !/^(macromolecule|simple chemical)( multimer)?$|^biological activity$/.test(c) && !hubGroup(i);
      return false;
    }
    function kindOf(i) {
      var c = (sbClasses()[nodes2[i].id] || '').replace(/ multimer$/, '');
      if (c === 'biological activity') return lookKey(c, sbJs.activities(shared.text)[nodes2[i].id]);
      return c || (nodes2[i].shape.kind === 'SimpleChemical' ? 'simple chemical' : 'macromolecule');
    }
    function sbSet(k, v, is) {   // every node of is given the value, one undo step; true when the text changed
      var ids = is.map(function (i) { return nodes2[i].id; }), t2 = shared.text;
      if (k === 'ant') {   // 1 to 200: the nearest, silently; the processes and gates of them, in one reading (sbgn_edit.fit)
        var L = parseFloat(v);
        return isFinite(L) && fitHubs(is.filter(function (i) { return hubGroup(i); }).map(function (i) { return { id: nodes2[i].id, ant: Math.min(Math.max(L, 1), 200) }; }));
      }
      ids.forEach(function (id) {
        if (k === 'label') t2 = sbJs.label(t2, id, v.replace(/[\r\n]+/g, ' '));
        else if (k === 'multimer') t2 = sbJs.multimer(t2, id, v);   // a count, if any, stays the unit of information typed (N:3)
        else if (k === 'width') { var x = parseFloat(v); if (isFinite(x)) t2 = sbJs.restyle(t2, id, { width: Math.min(Math.max(x, 0.25), 20) }); }   // outside 0.25 to 20: the nearest, silently
        else if (k === 'font') { var z = parseFloat(v); if (isFinite(z)) t2 = sbJs.restyle(t2, id, { font: Math.min(Math.max(Math.round(z * 2) / 2, 1), 200) }); }   // in halves, 1 to 200: the nearest, silently
        else if (k === 'way') { var ti = is.filter(function (i) { return nodes2[i].id === id; })[0]; if (ti != null && nodes2[ti].sub == null) t2 = tagTurnT(t2, ti, v); }   // a free tag turned, spinning (a terminal's follows its side)
        else {
          var c = hex(v), o = {};
          if (c !== null && !(c === '' && k === 'line')) { o[k] = c === '#000000' && k === 'line' ? null : c || null; t2 = sbJs.restyle(t2, id, o); }
        }
      });
      if (t2 === shared.text) return false;
      commit(t2, { name: 'properties', sel: ids, quiet: true });
      return true;
    }
    function sbEnds(id, o, box) { var t2 = sbJs.scaleEnds(shared.text, id, o, box); if (t2 !== shared.text) { setText(t2); parse(); } }   // a complex's line ends after its box was set (dragEnd, core.js)
    // a process made reversible or irreversible (sbgn_edit.reversible), from its right-click menu or Properties' Reversible
    // tick box: one undo step; the turned lines selected (the menu) or the process kept selected (Properties); false when
    // nothing changed
    function sbReversible(pid, on, keepNode) {
      var rv = sbJs.reversibility(shared.text, pid, { sbgn: src() }), n = rv ? (on ? rv.can : rv.rev) : 0, ids = [];
      if (!n) return false;
      for (var j = 0; j < n; j++) ids.push(freeId('arc_', ids));
      var t2 = sbJs.reversible(shared.text, pid, on, ids, { sbgn: src() });
      return commit(t2, { name: 'reversible', ids: [pid], sel: keepNode ? [pid] : [], selE: keepNode ? [] : ids, quiet: true });
    }
    function sbRxOf() {
      if (shared.selN.length !== 1 || shared.selE.length || shared.selP.length || shared.svSel) return null;
      var id = nodes2[shared.selN[0]] && nodes2[shared.selN[0]].id;
      if (!id || sbJs.PROCESSES.indexOf(sbClasses()[id] || '') < 0) return null;
      var key = id + '\u0000' + shared.text;
      if (sbRxSeen[0] !== key) { var rv = null; try { rv = sbJs.reversibility(shared.text, id, { sbgn: src() }); } catch (e) { rv = null; } sbRxSeen = [key, rv && (rv.can || rv.rev) ? { rid: id, on: rv.rev > 0 } : null]; }
      return sbRxSeen[1];
    }
    // a process's references (Properties, References; notes/annotation-editing.md): the process selected, or the one a
    // line selected alone goes to or from (a modifier's, a consumption's, a production's); the GraphML's property References
    // (sbgn_edit.refsOf), those the file holds under bqmodel shown as the file's, never removed (refsAbout)
    var sbRefsMemo;
    function __run6() {   // run at start, in order (__start)
    sbRefsMemo = [null, null, null, null, null];
    }   // [process, GraphML, file, its keys, those under bqmodel]: read once per text (Properties runs with every paint)
    function sbIsProc(i) { return i != null && !!nodes2[i] && sbJs.PROCESSES.indexOf(sbClasses()[nodes2[i].id] || '') >= 0; }
    function sbRefsOf() {
      if (!sbJs || !sbJs.refsOf || shared.selP.length || shared.svSel) return null;
      var pid = null, line = false;
      if (shared.selN.length === 1 && !shared.selE.length && sbIsProc(shared.selN[0])) pid = nodes2[shared.selN[0]].id;
      else if (shared.selE.length === 1 && !shared.selN.length && edges2[shared.selE[0]]) {
        var e = edges2[shared.selE[0]], n = sbIsProc(e.t) ? e.t : sbIsProc(e.s) ? e.s : null;
        if (n != null) { pid = nodes2[n].id; line = true; }
      }
      if (!pid) return null;
      var base = shared.sb && shared.sb.base;
      if (sbRefsMemo[0] !== pid || sbRefsMemo[1] !== shared.text || sbRefsMemo[2] !== base) {
        var keys = [], about = [];
        var sameBase = sbRefsMemo[0] === pid && sbRefsMemo[2] === base;   // those under bqmodel depend on the file alone
        try { keys = sbJs.refsOf(shared.text, pid).split(' ').filter(Boolean); about = sameBase ? sbRefsMemo[4] : base ? sbJs.refsAbout(base, pid) : []; } catch (e) { keys = null; }
        sbRefsMemo = [pid, shared.text, base, keys, about];
      }
      if (!sbRefsMemo[3]) return null;
      var ab = sbRefsMemo[4];
      return { id: pid, title: line ? 'References of its process' : 'References', items: sbRefsMemo[3].map(function (k) {
        var c = k.indexOf(':'), db = k.slice(0, c);
        return { key: k, db: db, val: k.slice(c + 1), q: ab.indexOf(k) >= 0 ? 'bqmodel:isDescribedBy' : 'bqbiol:isDescribedBy', own: ab.indexOf(k) < 0 && /^(pubmed|doi)$/.test(db), about: ab.indexOf(k) >= 0 };
      }) };
    }
    function sbRefsSet(pid, add, del) {
      var now = sbJs.refsOf(shared.text, pid).split(' ').filter(function (k) { return k && del.indexOf(k) < 0; });
      var t2 = sbJs.setRefs(shared.text, pid, now.concat(add.filter(function (k) { return now.indexOf(k) < 0; })).join(' '));
      return commit(t2, { name: 'references changed', ids: [pid], sel: shared.selN.map(function (i) { return nodes2[i].id; }), selE: shared.selE.map(function (k) { return edges2[k].id; }) });
    }
    // an entity's or a compartment's identifiers (Properties, Identifiers): the glyph selected alone on an SBGN-ML map, its
    // kind by its class (create.js ID_DBS); sbgn_edit.idsOf reads them from the file, or from the GraphML's Identity once
    // changed here
    var sbIdsMemo, SB_ID_KIND;
    function __run7() {   // run at start, in order (__start)
    sbIdsMemo = [null, null, null, null];
    SB_ID_KIND = { 'macromolecule': 'protein', 'macromolecule multimer': 'protein', 'nucleic acid feature': 'gene', 'nucleic acid feature multimer': 'gene', 'simple chemical': 'molecule', 'simple chemical multimer': 'molecule', 'phenotype': 'phenotype', 'compartment': 'compartment' };
    }
    function sbIdsOf() {
      var base = shared.sb && shared.sb.base;
      if (!sbJs || !sbJs.idsOf || !base || !/<([\w.-]+:)?sbgn[\s>]/.test(base.slice(0, 3000)) || shared.selP.length || shared.svSel || shared.selE.length || shared.selN.length !== 1 || !nodes2[shared.selN[0]]) return null;
      var id = nodes2[shared.selN[0]].id, kind = SB_ID_KIND[sbClasses()[id] || ''];
      if (!kind) return null;
      if (sbIdsMemo[0] !== id || sbIdsMemo[1] !== shared.text || sbIdsMemo[2] !== base) { var L; try { L = sbJs.idsOf(shared.text, base, id); } catch (e) { L = null; } sbIdsMemo = [id, shared.text, base, L]; }
      if (!sbIdsMemo[3]) return null;
      return { id: id, kind: kind, title: 'Identifiers', items: sbIdsMemo[3].map(annItem) };
    }
    function sbIdsSet(id, add, del) {   // the glyph's own (bqbiol:is, the five databases) less del, with add
      var own = sbJs.idsOf(shared.text, shared.sb.base, id).filter(function (x) { return idOwn(x.q, x.key) && del.indexOf(x.key) < 0; }).map(function (x) { return x.key; });
      var t2 = sbJs.setIds(shared.text, id, own.concat(add.filter(function (k) { return own.indexOf(k) < 0; })));
      return commit(t2, { name: 'identifiers changed', ids: [id], sel: [id], selE: [] });
    }
    function sbCount(k) {
      var id = edges2[k].id;
      if (sbCountMemo[0] !== id || sbCountMemo[1] !== shared.text) { var c; try { c = sbJs.countOf(shared.text, id); } catch (e) { c = undefined; } sbCountMemo = [id, shared.text, c]; }
      return sbCountMemo[2];
    }
    function sbEdgeEl(k) { var el = edges2[k].path.parentNode; while (el && el.localName !== 'edge') el = el.parentNode; return el; }
    function sbLineColour(k) { return sbJs.lineOf(sbEdgeEl(k)) || '#000000'; }
    function sbLineSet(k, c) { return sbLineTo(k, sbJs.recolour(shared.text, edges2[k].id, c)); }   // c '#rrggbb', null for black (yEd's default, no colour written); false when nothing changed
    function sbLineWidth(k, w) { return sbLineTo(k, sbJs.rewidth(shared.text, edges2[k].id, w)); }   // w 1 the default
    function sbLineTo(k, t2) {   // the line's text changed: one undo step, the line selected again
      var id = edges2[k].id;
      return commit(t2, { name: 'line look', ids: [id], then: function () { shared.selE = []; edges2.forEach(function (q, j) { if (q.id === id) shared.selE = [j]; }); } });
    }
    function sbDef(i) {
      var o = sbJs.lookOf(realizerOf(nodes2[i].el)), b = boxOf(i), all = defsKept(), g = hubGroup(i);
      if (g) HUB_KINDS[g].forEach(function (c) { all[c] = { w: b[2], h: b[3], fill: o.fill, line: o.line, width: o.width, ant: sbAnts()[nodes2[i].id] }; });   // every kind drawn alike (a process's three, the gates), the letters left standard
      else all[kindOf(i)] = { w: b[2], h: b[3], fill: o.fill, line: o.line, width: o.width, multimer: o.multimer, font: o.font };   // as it is, no share of another size
      if (!keepLook(DEF_KEY, all)) return;
      keepMapChoice('style', 'custom'); keepMapChoice('cols', 'custom'); styleRow(); sbColsRow();
    }
    function hubGroup(i) {
      var c = i != null && nodes2[i] ? sbClasses()[nodes2[i].id] || '' : '';
      return HUB_KINDS.process.indexOf(c) >= 0 ? 'process' : HUB_KINDS.gate.indexOf(c) >= 0 ? 'gate' : null;
    }
    function sbAnts() { if (antMemo[0] !== shared.text) antMemo = [shared.text, sbJs.antennas(shared.text, { sbgn: src() })]; return antMemo[1]; }
    // Properties' Apply to all of this kind and Standard size, for processes and gates
    function __run2() {   // run at start, in order (__start)
    props.querySelector('.m2-ed-pall').addEventListener('click', function () {
      var i = propNode(), g = i >= 0 ? hubGroup(i) : null;
      if (!g) return;
      var b = boxOf(i), ant = sbAnts()[nodes2[i].id], lt = sbJs.GLT.test(sbClasses()[nodes2[i].id] || '') ? sbJs.lookOf(realizerOf(nodes2[i].el)).font : null;
      var items = nodes2.map(function (n, k) {
        if (k === i || hubGroup(k) !== g) return null;
        var o = boxOf(k);
        return { id: n.id, box: [+fmt(o[0] + o[2] / 2 - b[2] / 2), +fmt(o[1] + o[3] / 2 - b[3] / 2), b[2], b[3]], ant: ant, letters: lt };
      }).filter(Boolean);
      if (!keepSel(function () { return fitHubs(items); })) warn('Every one of this kind already has this size and antenna.');
    });
    props.querySelector('.m2-ed-pstd').addEventListener('click', function () {
      var ns = propNodes().filter(function (i) { return hubGroup(i); });
      if (!ns.length) return;
      var s = stdScale(), lt = stdLetters();
      var items = ns.map(function (i) {
        var gate = hubGroup(i) === 'gate', S = sbJs.SIZE[gate ? 'and' : 'process'], o = boxOf(i), w = S[0] * s, h = S[1] * s;
        return { id: nodes2[i].id, box: [+fmt(o[0] + o[2] / 2 - w / 2), +fmt(o[1] + o[3] / 2 - h / 2), w, h], ant: sbJs.ANT * s, letters: gate ? lt : null };
      });
      if (!keepSel(function () { return fitHubs(items); })) warn('Already at the standard size and antenna.');
    });
    }
    // Colours on SBGN-ML maps, kept per map or read from it (mapCols): the map's own (sbgn_edit.defaults: the fill most glyphs of the
    // kind have; the Default colours for a kind the map lacks), the viewer's Default colours, none, or Confetti
    function sbCols() { return mapCols(['file', 'none', 'default', 'confetti', 'custom'], sbIs); }
    function sbSquares(mode) {   // five at most, the first at the right (row-reverse), each colour once
      if (mode === 'confetti') return confettiSquares();
      var seen = {}, h = '', kept = mode === 'custom' ? defsKept() : {};
      SB_SQ.forEach(function (c) {
        var k = kept[c], x = mode === 'none' ? '#FFFFFF' : mode === 'default' ? sbJs.fillFor(c) : k && k.fill ? k.fill : sbJs.defaults(src(), null, c).fill || '#FFFFFF';
        x = String(x).toUpperCase();
        if (seen[x]) return; seen[x] = 1;
        h += '<i style="background:' + x + '" title="' + c + ', ' + x + '"></i>';
      });
      return '<span class="m2-cs-sw">' + h + '</span>';
    }
    function sbColsRow() { return palDrop({ key: 'cols', label: 'Colours', title: 'Colours of the map and of new glyphs', list: SB_COLS, get: sbCols, set: function (v) { colsPick(v, sbCols(), function () { return sbJs.colours(shared.text); }, sbOriginal, sbRecolour); }, sq: sbSquares }); }
    function sbOriginal(r) {   // the colours kept put back: each node's fill and border, each line's, those the record knows
      var now = sbJs.colours(shared.text), M = {}, added = 0;
      Object.keys(now.node).forEach(function (id) { var o = r.node && r.node[id], a = now.node[id]; if (!o) added++; else if (o.fill !== a.fill || o.line !== a.line) M[id] = { fill: o.fill, line: o.line }; });
      Object.keys(now.edge).forEach(function (id) { if (!r.edge || !(id in r.edge)) added++; });
      var t2 = sbJs.restyleAll(shared.text, M, null, function (id) { return r.edge && id in r.edge && r.edge[id] !== now.edge[id] ? r.edge[id] : undefined; });
      commit(t2, { name: 'colours from a file', sel: [], quiet: true });
      return added;
    }
    // a choice of Colours recolours the whole map, one undo step: every entity, complex, compartment, tag and terminal its fill by the
    // choice (its border black), as a new one of its kind would get it (defOf); Original puts back the map's own (colsPick); Custom a
    // kind with a kept look its fill, border and width, the rest as they are; Confetti every entity, complexes too, a pastel
    // of its own, one after another (compartments as they are). Every line black, under Confetti a colour of its own
    // (confettiLine); processes, gates and the other glyphs their border black. One parse (sbgn_edit.restyleAll)
    function sbPlan(mode, pick) {   // [[node index, its look], ...] under a choice of Colours, as sbRecolour sets them (pick: Confetti's colours picked)
      if (sbActMemo[0] !== shared.text) sbActMemo = [shared.text, sbJs.activities(shared.text)];   // one parse per change of the map (sbIs asks for each choice)
      var cls = sbClasses(), acts = sbActMemo[1], kept = mode === 'custom' ? defsKept() : {}, hues = [], P = [];
      nodes2.forEach(function (n, i) {
        var c = cls[n.id] || '';
        if (!SB_FILLED.test(c)) { if (sbJs.LOOKS.test(c) && mode !== 'custom') P.push([i, { line: null }]); return; }
        var base = c.replace(/ multimer$/, ''), u = acts[n.id], o;
        var ff = sbJs.fillFor(u != null ? 'biological activity' : base === 'terminal' ? 'tag' : base, u);   // a terminal coloured as a tag
        if (mode === 'default') o = { fill: ff, line: null };
        else if (mode === 'none') o = { fill: null, line: null };
        // Custom: a look kept the old way (a share of a size, no w) left out, as defOf
        else if (mode === 'custom') { var k = kept[lookKey(base, u)]; if (!k || !(k.w > 0)) return; o = {}; ['fill', 'line', 'width'].forEach(function (q) { if (q in k) o[q] = k[q]; }); }
        else { if (!ff || base === 'compartment') return; o = { fill: pick ? confettiPick(hues).toUpperCase() : true, line: null }; }   // Confetti (fill true: filled, no colour picked)
        P.push([i, o]);
      });
      return P;
    }
    function sbIs(mode) {   // the map's glyphs filled as the choice fills them (Confetti: each a confetti pastel; Original: as kept); null: none to read
      if (!palOn()) return false;
      if (mode === 'file') {
        var r = origAll()[palId()];
        if (!r) return null;
        var now = sbJs.colours(shared.text);
        return Object.keys(r.node || {}).every(function (id) { var a = now.node[id], o = r.node[id]; return !a || (a.fill === o.fill && a.line === o.line); }) &&
          Object.keys(r.edge || {}).every(function (id) { return !(id in now.edge) || now.edge[id] === r.edge[id]; });
      }
      var P = sbPlan(mode, false).filter(function (q) { return 'fill' in q[1]; });
      if (!P.length) return null;
      return P.every(function (q) {
        var f = sbJs.lookOf(realizerOf(nodes2[q[0]].el)).fill;
        return mode === 'confetti' ? confettiOne(f) : (f ? f.slice(0, 7).toUpperCase() : null) === (q[1].fill ? q[1].fill.toUpperCase() : null);
      });
    }
    function sbRecolour(mode) {
      if (mode === 'file' || !palOn()) return;
      var M = {};
      sbPlan(mode, true).forEach(function (q) { M[nodes2[q[0]].id] = q[1]; });
      var lh = [], t2 = sbJs.restyleAll(shared.text, M, null, mode === 'custom' ? null : function () { return mode === 'confetti' ? confettiLine(lh).toUpperCase() : null; });
      commit(t2, { name: 'colours', sel: [], quiet: true });
    }
    function svBase(i) {
      var c = ((sbClasses()[nodes2[i].id] || '').replace(/ multimer$/, '')) || 'macromolecule', b = boxOf(i);
      try { var D = defOf(c); if (D && D.w && D.h) return [D.w, D.h]; } catch (e) { /* its own size */ }
      return [b[2], b[3]];
    }
    function svCopies(id) {   // the other macromolecules named as node id (an SBGN-ML map's, Process Description): their ids
      var i = svIdx(id);
      if (!shared.sb || shared.afSbgn || afKind() || i < 0 || nodes2[i].shape.kind !== 'Macromolecule' || !svNm(i)) return [];
      var nm = svNm(i);
      return nodes2.filter(function (n, k) { return k !== i && n.shape.kind === 'Macromolecule' && svNm(k) === nm; }).map(function (n) { return n.id; });
    }
    // after state variable n of node id was typed from was to now (at place r0 before): its variable named or renamed on
    // every copy (their values kept), added where a copy has none; a copy that has the new variable already keeps that
    // one, its twin dropped when empty (else left, its value its own)
    function svShareText(id, was, r0, n, now) {
      var ov = svVar(was), nv = svVar(now), i = svIdx(id), q = i >= 0 ? svOnly(i)[n] : null, r = q ? svR(i, q) : r0;
      if (!ov && !nv) return;   // a value alone: each glyph's own
      svCopies(id).forEach(function (c) {
        var m = svTwin(c, was, r0), has = nv ? svTwin(c, now, r) : -1;
        if (m >= 0 && ov !== nv) {
          var k = svIdx(c), wb = boxOf(k), cur = svOnly(k)[m][0];
          if (has >= 0 && has !== m) { if (!cur) { setText(sbJs.stateDelete(shared.text, c, m, { sbgn: shared.sb.base })); parse(); } return; }
          setText(sbJs.stateValue(shared.text, c, m, svVal(cur) + (nv ? '@' + nv : ''))); parse();
          if (svSettle(c, m)) svHold(c, wb);
        } else if (m < 0 && nv && has < 0) svAddTo(c, r, '@' + nv);
      });
    }
    // state variable q of node i (at r0) taken to place r, or deleted (r null), on every copy
    function svShareMove(i, q, r0, r) {
      var ws = svCopies(nodes2[i].id).map(function (c) { return [c, svTwin(c, q[0], r0)]; }).filter(function (w) { return w[1] >= 0; });
      return function () {
        ws.forEach(function (w) {
          var k = svIdx(w[0]);
          if (k < 0) return;
          if (!r) { setText(sbJs.stateDelete(shared.text, w[0], w[1], { sbgn: shared.sb.base })); return; }
          var b = boxOf(k), ic = svIconsOn(k), me = ic.filter(function (o) { return o.k === SV && o.n === w[1]; })[0];
          if (me && !svClash(svPt(b, r), me.s, b, ic.filter(function (o) { return o !== me; }))) setText(sbJs.stateMove(shared.text, w[0], w[1], r[0], r[1]));
        });
        parse();
      };
    }
    function cardAll() { if (cardMemo[0] !== shared.text) cardMemo = [shared.text, shared.sb && sbJs && sbJs.countsAt ? sbJs.countsAt(shared.text) : {}]; return cardMemo[1]; }
    function cardAt(P) {   // the id of the line whose cardinality's box is under P (map units)
      if (!shared.sb || !sbJs || !sbJs.countsAt || shared.text.indexOf('<y:EdgeLabel') < 0) return null;
      var o = cardAll(), pad = 2 / V.z, got = null;
      Object.keys(o).forEach(function (id) { var b = o[id].box; if (P[0] >= b[0] - pad && P[0] <= b[0] + b[2] + pad && P[1] >= b[1] - pad && P[1] <= b[1] + b[3] + pad) got = id; });
      return got;
    }
    var SB_COLS;
    function __run3() {   // run at start, in order (__start)
    SB_COLS = [['file', 'Original', 'The map\u2019s own colours, as they were before another choice; new glyphs in the colour most glyphs of their kind have on it'], ['default', 'Mist and sage', 'The whole map and new glyphs in the viewer\u2019s starting colours: a pale blue for proteins, a pale green for small molecules'], ['none', 'No colours', 'The whole map and new glyphs unfilled'], ['custom', 'Custom default', 'The whole map and new glyphs in the colours kept by Set as default; a kind with none as it is'], ['confetti', 'Confetti', 'Every glyph of the map, and every new one, a pastel of its own']];
    }
    var SB_SQ;
    function __run4() {   // run at start, in order (__start)
    SB_SQ = ['macromolecule', 'simple chemical', 'nucleic acid feature', 'phenotype', 'compartment'];
    }
    var SB_FILLED, sbActMemo;
    function __run5() {   // run at start, in order (__start)
    SB_FILLED = /^(macromolecule|simple chemical|nucleic acid feature|unspecified entity|perturbing agent|phenotype|complex|compartment|submap|biological activity|perturbation|tag|terminal)( multimer)?$/;
    sbActMemo = [null, {}];
    }
    function svVal(s) { var a = (s || '').indexOf('@'); return a < 0 ? s || '' : s.slice(0, a); }
    function svNm(i) { return nameOf(i).replace(/\s+/g, ' ').trim(); }
    function fitHubs(items) {
      if (!items.length) return false;
      var was = {}; items.forEach(function (it) { var i = nodes2.findIndex(function (n) { return n.id === it.id; }); was[it.id] = boxOf(i); });
      var t2;
      try { t2 = sbJs.fit(shared.text, items, { sbgn: src() }); } catch (err) { warn('Not changed: ' + (err && err.message || err) + '.'); return false; }
      if (t2 === shared.text) return false;
      var sel = shared.selN.map(function (i) { return nodes2[i].id; });
      commit(t2, { name: 'size', ids: Object.keys(was), then: function () {   // the nodes selected again, lines and bend points kept
      shared.selN = []; nodes2.forEach(function (n, k) { if (sel.indexOf(n.id) >= 0) shared.selN.push(k); });
      var ks = nodes2.map(function (n, k) { return was[n.id] ? k : -1; }).filter(function (k) { return k >= 0; });
      if (ks.length) setBoxes(grown(ks, boxOf, function (k) { return was[nodes2[k].id] || boxOf(k); }, function () { return false; }));   // their holders grown round them (sbSetSize)
      refit(Object.keys(was));
      } });
      return true;
    }
    export function __start() { __run1(); __run2(); __run3(); __run4(); __run5(); __run6(); __run7(); }   // the part's statements, in their order
    export { afKind, cardAll, cardAt, hubGroup, hybridActs, palKind, palOn, PF_SB, sbAnts, sbCols, sbColsRow, sbFileAf, sbReversible, svBase, svCopies, svDeleteSb, svShareMove, svShareText };
