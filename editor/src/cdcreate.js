import { shared, V } from './state.js';
import { at, boxOf, changed, commit, cutShape, edgeAt, edges2, editing, f1, fmt, gridSet, grown, handleMarks, hit, keyFlush, kindWindow, landMarks, lateItem, line, map, near, nodes2, on, paint, parse, ports, procPlaces, quiet, rclick, render, setBoxes, shapeD, subItem, sx, sy, toGrid, warn, x0, y0 } from './core.js';
import { bx, liveOff, sizeOff } from './live.js';
import { cdJs, cdMk, cdNow, cdRebuild, nodeCentre, nodePlaces } from './celldesigner.js';
import NT from '../../renderers/converter/notation.js';   // the notation's kinds and rules table, as on the SBGN maps (create.js ruleSays)
import { ARCS, PAL_KEY, SS, SV, UI, colsPick, confettiFill, confettiHues, confettiLine, confettiOne, confettiPick, confettiSquares, hex, iconKeep, iconSpread, innermost, joinPack, keepLook, keepMapChoice, link, linkEnd, looksKept, mapCols, nameAt, origAll, pNow, pal, palBlocks, palDid, palDrop, palId, palShow, palSigns, palSignsEl, palStore, palStyle, palTake, placedAt, propRows, styleRow, svAt, svDelete, svIcons, textsOf, tool, typeIn } from './create.js';

    // ---------- the CellDesigner palette (editor/src/cdcreate.js) ----------
    // The CellDesigner palette, writing the CellDesigner file directly: on a CellDesigner map with Settings, Editing on Full, the Edit
    // window's palette offers CellDesigner's own set, SBGN-suited only: species, logic gates, reactions,
    // modifiers and, with the Reduced notation tick box, CellDesigner's reduced notation. The gestures are the SBGN
    // palette's (create.js): a click takes a sign once, a double click keeps it in hand, a sign dragged onto the map is put
    // where it is dropped; a drag from a node with a line's sign picked draws that line;
    // a gate takes three clicks (its inputs, then the reaction's square or the target entity; a NOT or unknown gate one
    // input), placed where CellDesigner puts it (cd_make.gate). Every change is written into the CellDesigner file by
    // cd_make (renderers/converter/cd_make.js, tests/cd-make.js), the editor's GraphML made again from it by cd_edit, so
    // the saved file opens in CellDesigner 4.4 as it was left; one undo step each (core.js keeps the file in the step).
    // the kinds are cd_make's (LOOK, PROCESS, MODS, REDUCED, NEED) and the gate signs cdrender's GATE, written here as
    // well because the palette is drawn before those files load; cdCheck() compares them once they have
    // each sign drawn as CellDesigner's own toolbar draws it, in the palette's weights (atlas-app.html, Sign weights); a
    // species' shape in the proportions CellDesigner gives it on the map where those cannot change (RNA's slant at 45 degrees)
    var CD_SP;
    function __run1() {   // run at start, in order (__start)
    CD_SP = [['PROTEIN', 'Protein', '<rect x="1.5" y="5" width="21" height="14" rx="3.5"/>'],
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
    }
    function cdComp(cls) { return cls === 'COMPARTMENT' || cls === 'OVAL'; }   // the two compartment kinds of the palette
    // gates: the circle with its sign, the input lines above (one for NOT, which takes one input) and the output line
    // below; the signs centred in the circle
    // (the bar and ! drawn, not letters, so they sit in its middle); the fourth item is cdrender's GATE sign, for cdCheck
    var CD_Q, CD_GATES, CD_LINE, CD_HEAD, CD_RX, CD_DOTS, CD_ADD, CD_MOD, CD_RED, RED_OF, CD_NAME, cdK;
    function __run2() {   // run at start, in order (__start)
    CD_Q = '<path d="M9.8 10.2a2.2 2.2 0 1 1 3.2 2c-.7.4-1 .8-1 1.6" class="in"/><circle class="dot" cx="12" cy="16.4" r=".8"/>';
    CD_GATES = [['AND', 'AND gate', '<text x="12" y="16.2" text-anchor="middle" font-size="9">&amp;</text>', '&amp;'], ['OR', 'OR gate', '<path d="M12 9.5v7" class="in"/>', '|'],
      ['NOT', 'NOT gate', '<path d="M12 9.6v4.6" class="in"/><circle class="dot" cx="12" cy="16.6" r=".8"/>', '!'], ['UNKNOWN', 'Unknown gate', '<g transform="translate(0 .7)">' + CD_Q + '</g>', '?']].map(function (q) {
      var ins = q[0] === 'NOT' ? 'M12 1v5.5' : 'M3 4l4.4 4.4M21 4l-4.4 4.4';
      return [q[0], q[1], '<circle cx="12" cy="13" r="6.5"/><path d="' + ins + 'M12 19.5V23"/>' + q[2], q[3]];
    });
    // a reaction: the bare arrow with CellDesigner's filled head, the omitted one crossed by two slashes, the unknown one by ?
    CD_LINE = '<path d="M1.5 12h15"/>', CD_HEAD = '<path d="M16 8.5l6.5 3.5-6.5 3.5z" fill="currentColor"/>';
    CD_RX = [['STATE_TRANSITION', 'State transition', CD_LINE + CD_HEAD],
      ['KNOWN_TRANSITION_OMITTED', 'Known transition omitted', CD_LINE + '<path d="M6.5 16l2.5-8M10 16l2.5-8" class="in"/>' + CD_HEAD],
      ['UNKNOWN_TRANSITION', 'Unknown transition', CD_LINE + '<g transform="translate(-2.5 -1.5)">' + CD_Q + '</g>' + CD_HEAD]];
    // a line joined to a reaction that is already there, as CellDesigner's Add Reactant and Add Product: its main line
    // dotted, the added line meeting it (no arrowhead) or leaving it (with the reaction's arrowhead)
    CD_DOTS = '<path d="M1.5 18h21" class="in" stroke-dasharray="1.4 3.5"/>';   // 5 dashes, both ends a dash, the join (x 11) on one; gaps wide for the round ends (+.65 each) so it reads dashed at 21 px
    CD_ADD = [['ADD_REACTANT', 'Add reactant (from a species onto a reaction; onto a logic gate, a new input)', CD_DOTS + '<path d="M3.5 4.5L11 18"/>'],
      ['ADD_PRODUCT', 'Add product (from a reaction to a species)', CD_DOTS + '<path d="M11 18l6-9"/><path d="M20.5 4l-.6 6.6-5.2-3.4z" fill="currentColor"/>']];
    // a modifier points down onto a reaction, as in CellDesigner's toolbar. The same signs draw reduced notation: with the
    // Reduced notation tick box ticked, a modifier's sign dragged from species to species makes CellDesigner's reduced
    // notation type for it (CD_RED), written as such in the file; catalysis has none in CellDesigner
    CD_MOD = [['CATALYSIS', 'Catalysis', '<path d="M12 1.5v14"/><circle cx="12" cy="18.5" r="3"/>'],
      ['INHIBITION', 'Inhibition', '<path d="M12 1.5v19M7 20.5h10"/>'],
      ['PHYSICAL_STIMULATION', 'Physical stimulation', '<path d="M12 1.5v12.5M7.5 14h9l-4.5 7.5z"/>'],
      ['MODULATION', 'Modulation', '<path d="M12 1.5v11M12 12.5l3.5 4.5-3.5 4.5-3.5-4.5z"/>'],
      ['TRIGGER', 'Trigger', '<path d="M12 1.5v13.5M7 11.5h10M7.5 15h9l-4.5 7z"/>']].map(function (q) {
      return [q[0], q[1] + (q[0] === 'CATALYSIS' ? ' (onto a reaction)' : ' (onto a reaction, or between species with Reduced notation ticked)'), q[2]];
    });
    // reduced notation's types, each named as the modifier whose sign draws it (no positive influence: CellDesigner's open
    // arrowhead is not SBGN's, the file's taken in as the open triangle, cd_make sbgn)
    CD_RED = [['NEGATIVE_INFLUENCE', 'INHIBITION'], ['REDUCED_PHYSICAL_STIMULATION', 'PHYSICAL_STIMULATION'], ['REDUCED_MODULATION', 'MODULATION'], ['REDUCED_TRIGGER', 'TRIGGER']];
    RED_OF = {}; CD_RED.forEach(function (q) { RED_OF[q[1]] = q[0]; });   // a modifier's type -> its reduced notation type
    CD_NAME = {};   // CellDesigner's names, for the menus and the status line (a gate's by G_ and its kind: UNKNOWN is a species too)
    CD_SP.concat(CD_RX, CD_ADD, CD_MOD).forEach(function (q) { CD_NAME[q[0]] = q[1].replace(/ \(.*\)$/, ''); });
    CD_RED.forEach(function (q) { CD_NAME[q[0]] = CD_NAME[q[1]]; });
    CD_GATES.forEach(function (q) { CD_NAME['G_' + q[0]] = q[1]; });
    cdK = function (q) { return ['cd:' + q[0], q[1], q[2]]; };
    }   // the tool kinds, apart from the SBGN palette's
    function palCd() {   // the set: nodes, the gates, the lines last (as the SBGN palette); three blocks in the one list: species, gates, lines
      return [['Species', CD_SP.map(cdK)], ['Logic gates', CD_GATES.map(function (q) { return ['cd:G_' + q[0], q[1], q[2]]; }), true], ['Reactions', CD_RX.concat(CD_ADD).map(cdK), true], ['Modifiers', CD_MOD.map(cdK)]];
    }
    var CD_GATE;
    function __run3() {   // run at start, in order (__start)
    CD_RX.concat(CD_ADD, CD_MOD).forEach(function (q) { ARCS['cd:' + q[0]] = 1; });   // the signs that draw a line (arcTool)
    CD_GATE = {}; CD_GATES.forEach(function (q) { CD_GATE['cd:G_' + q[0]] = q[0]; });
    }   // tool kind -> gate kind
    function cdKind(k) { return k && k.indexOf('cd:') === 0 ? k.slice(3) : null; }

    // the palette shown on a CellDesigner map (palShow, create.js)
    function cdPal() { return on && V.current === map && !!shared.cd && !!cdJs && !!cdMk && V.level === 'full'; }
    function cdStrict() {   // the Reduced notation tick box, per map as on SBGN-ML maps (unticked: no reduced notation)
      var id = palId();
      if (shared.cdStrictMemo[0] !== id) { var k = palStore()[id]; shared.cdStrictMemo = [id, !!(k && k.strict === true)]; }
      return shared.cdStrictMemo[1];
    }
    function cdFill() {
      ['.m2-ed-pnot', '.m2-ed-plook', '.m2-ed-pprot', '.m2-ed-pcdc', '.m2-ed-psbgn'].forEach(function (c) { pal.querySelector(c).hidden = true; });   // no PD and AF on a CellDesigner map
      pal.querySelector('.m2-ed-pnot').style.display = 'none';   // a row: its display wins over hidden
      var hy = pal.querySelector('.m2-ed-pstrict'), hyc = hy.querySelector('input'), strict = cdStrict();
      hy.hidden = false;
      if (hyc.checked !== !strict) hyc.checked = !strict;
      cdInfo(hy, true);
      styleRow(); cdColsRow();
      var k = 'cd' + (strict ? 'S' : '');
      if (shared.palShown === k) return;
      shared.palShown = k;
      palSignsEl.innerHTML = palSigns(palCd()); palBlocks();
    }
    // the tick box's title and circled i's text on a CellDesigner map say what it does there (the SBGN text speaks of
    // hybrid maps and SBGN-ML files); palFill puts the SBGN ones back
    var CD_INFO;
    function __run5() {   // run at start, in order (__start)
    CD_INFO = 'Lets the modifiers\u2019 signs (inhibition, physical stimulation, modulation, trigger) join two species directly, written as CellDesigner\u2019s reduced notation, and allows a logic gate between species. Unticked: reactions and their modifiers only. CellDesigner\u2019s positive influence (an open arrowhead, not an SBGN sign) is made a physical stimulation when a map is opened.';
    }
    function cdInfo(hy, on_) {
      var lab = hy.querySelector('label'), ti = hy.querySelector('.m2-ed-ptip');
      if (!lab.dataset.sbgn) { lab.dataset.sbgn = lab.title; ti.dataset.sbgn = ti.dataset.info; }
      var v = on_ ? CD_INFO : ti.dataset.sbgn;
      if (ti.dataset.info !== v) { lab.title = on_ ? 'Ticked (the default): the reduced notation signs shown' : lab.dataset.sbgn; ti.dataset.info = v; }
    }
    function cdCheck() {   // the palette's kinds against cd_make's and cdrender's, once loaded: a drift said in the console
      var g = window.cdrender && window.cdrender.GATE, miss = CD_SP.filter(function (q) { return !cdComp(q[0]) && !cdMk.LOOK[q[0]]; }).map(function (q) { return q[0]; })
        .concat(CD_RX.filter(function (q) { return cdMk.PROCESS.indexOf(q[0]) < 0; }).map(function (q) { return q[0]; }), CD_MOD.filter(function (q) { return cdMk.MODS.indexOf(q[0]) < 0; }).map(function (q) { return q[0]; }),
          CD_RED.filter(function (q) { return cdMk.REDUCED.indexOf(q[0]) < 0; }).map(function (q) { return q[0]; }), CD_GATES.filter(function (q) { return !cdMk.NEED[q[0]]; }).map(function (q) { return q[0]; }));
      if (miss.length) console.error('The CellDesigner palette offers kinds cd_make lacks: ' + miss.join(', '));
      if (g) CD_GATES.forEach(function (q) { var v = g[q[0]]; if (v && q[3] !== v) console.error('The palette\u2019s ' + q[1] + ' sign differs from cdrender\u2019s ' + v); });
    }
    function __run6() {   // run at start, in order (__start)
    pal.querySelector('.m2-ed-pstrict input').addEventListener('change', function (e) {   // on a CellDesigner map: kept per map, modifiers' signs between species allowed or not
      if (!cdPal()) return;
      palDid([PAL_KEY], function () {
        var all = palStore(), id = palId();
        shared.cdStrictMemo = [id, !e.target.checked];
        if (id) { all[id] = { lang: 'pd', look: 'rn', strict: !e.target.checked }; try { localStorage.setItem(PAL_KEY, JSON.stringify(all)); } catch (er) {} }
      });
      shared.palShown = null; palShow();
    });
    }

    // a change made by the palette: the new CellDesigner text the file, the editor's GraphML made again from it, one undo
    // step; sel the node ids, selLines the line ids (a reaction's id: its main line) selected after it, either a function
    // giving them once fn has run
    function cdApply(fn, sel, selLines) {
      keyFlush();   // a run of arrow keys settled first (else a nudge then Delete within 150 ms loses the nudge)
      var N = cdNow(), now = N.t;   // a move not drawn yet is in the file too
      var t2;
      cdGrew = {};
      try { t2 = fn(now, N.sh); } catch (err) { cdGrew = null; if (!(err && err.refused)) warn(String(err && err.message || err).replace(/\.?$/, '.')); return false; }   // a rule of the format (cd_make's refuse): nothing said; a fault in red
      if (t2 && t2.text != null) t2 = t2.text;
      var grew = cdGrew; cdGrew = null;
      if (!t2 || t2 === now) return false;
      return commit(null, { name: 'CellDesigner change', ids: [].concat(typeof sel === 'function' ? [] : sel || []), quiet: true, write: function () { cdRebuild(t2, N.sh); }, then: function () {
      var gk = nodes2.map(function (n, k) { return grew[n.id] ? k : -1; }).filter(function (k) { return k >= 0; });   // species grown for an icon: what holds them grown round them (as cdSetSize)
      if (gk.length) setBoxes(grown(gk, boxOf, function (k) { return grew[nodes2[k].id] || boxOf(k); }, function () { return false; }));
      shared.selN = []; shared.selP = []; shared.selE = []; shared.part = null;
      if (typeof sel === 'function') sel = sel();
      if (typeof selLines === 'function') selLines = selLines();
      (sel || []).forEach(function (id) { nodes2.forEach(function (n, i) { if (n.id === id) shared.selN.push(i); }); });
      (selLines || []).forEach(function (id) { edges2.forEach(function (q, k) { if (q.id === id || q.id === id + '|a' || q.id === id + '|b') shared.selE.push(k); }); });
      } });
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
    // the colours of new species and compartments (Colours under the palette, palDrop in create.js, kept per map or read
    // from it, create.js mapCols): the file's (the colour most species of the class, or most compartments, already have on
    // the map; the Default one for a class the map has none of; the choice when none is kept), CellDesigner's own (cd_make
    // LOOK and COMP), the viewer's Default scheme (Settings, Map colours) by the class's role, or none (white, as
    // CellDesigner has no unfilled species), or Confetti (a pastel of its own, create.js confettiFill)
    var CD_COLS, CD_COMP_DEFAULT;
    function __run7() {   // run at start, in order (__start)
    CD_COLS = [['file', 'Original', 'The map\u2019s own colours, as they were before another choice; new species and compartments in the colour most of their class have on it, Default for a class it has none of'], ['cd', 'CellDesigner', 'The whole map and new species and compartments in CellDesigner\u2019s own colours'], ['default', 'Mist and sage', 'The whole map and new species and compartments in the viewer\u2019s starting colours: a pale blue for proteins, a pale green for small molecules'], ['none', 'No colours', 'The whole map and new species and compartments white'], ['custom', 'Custom default', 'The whole map and new species in the colours kept by Set as default; a class with none as it is'], ['confetti', 'Confetti', 'Every species of the map, and every new one, a pastel of its own; compartments as they are']];
    // the Default compartment's paint, the official maps': cdrender draws a compartment's band at a quarter of its colour,
    // so this shows as the Default scheme's compartment (#F7F6F3, sbgn_edit FILL; tests/cd-colours-default.js checks the two agree)
    CD_COMP_DEFAULT = 'ffdfdbce';
    }
    function cdCols() { return mapCols(['file', 'none', 'cd', 'default', 'confetti', 'custom'], cdIs); }
    function cdIs(mode) {   // the map's species coloured as the choice colours them (cdFills), or each a confetti pastel, or as kept for Original; null: no species to read or nothing kept (cd_make.classColours, one pass kept per text)
      var t = shared.cd && shared.cd.now;
      if (!t || !cdMk) return false;
      if (mode === 'file') {   // Original: every element the record knows in its kept colour
        var r = origAll()[palId()];
        if (!r) return null;
        var now = cdMk.colours(t), same = function (a, b2) { return a == null || b2 == null || String(a).toLowerCase() === String(b2).toLowerCase(); };
        return Object.keys(r.fill || {}).every(function (id) { return same(now.fill[id], r.fill[id]); }) &&
          Object.keys(r.line || {}).every(function (id) { var a = now.line[id] || {}; return Object.keys(r.line[id]).every(function (q) { return same(a[q], r.line[id][q]); }); });
      }
      var n = cdMk.classColours(t), cols = [];
      Object.keys(n).forEach(function (cls) { if (cls !== 'DEGRADED') cols = cols.concat(Object.keys(n[cls])); });
      if (!cols.length) return null;
      if (mode === 'confetti') return cols.every(function (c) { return confettiOne('#' + c.slice(2)); });
      var fn = cdFills(mode, t), read = 0;   // under these choices a class's fill depends on its class only; a class the choice leaves as it is not read
      var all = Object.keys(n).every(function (cls) { var x = cls === 'DEGRADED' ? null : fn(cls); if (x) read++; return !x || Object.keys(n[cls]).every(function (c) { return c.slice(2) === x.slice(1).toLowerCase(); }); });
      return read ? all : null;
    }
    var CD_UNKNOWN;
    function __run8() {   // run at start, in order (__start)
    CD_UNKNOWN = 'ffdddddd';
    }   // a light grey for Unknown under Default and No colours (CellDesigner's own is cccccc)
    function cdColour(t, cls) { return cdColourIn(cdCols(), t, cls); }   // eight hex digits for cd_make, or null for CellDesigner's own
    function cdColourIn(m, t, cls) {
      var comp = cdComp(cls);
      if (m === 'none') return cls === 'UNKNOWN' ? CD_UNKNOWN : 'ffffffff';   // Unknown is drawn with no outline: a white one would not show
      if (m === 'confetti') { if (cls !== 'DEGRADED' && !comp) return 'ff' + confettiFill(t).slice(1); m = 'file'; }   // create.js (no file yet: the first hue); a degraded species or a compartment as From map
      if (m === 'custom') { var k = !comp && cdKept()[cls]; if (k && k.fill) return 'ff' + k.fill.slice(1).toLowerCase(); m = 'file'; }   // a class with none kept: From map
      if (m === 'file') { var f = t ? (comp ? cdMk.compartmentColour(t) : cdMk.classColour(t, cls)) : null; if (f) return f; m = 'default'; }   // none of that class on the map (or no file yet): Default
      if (m === 'cd') return comp ? cdMk.COMP.colour : null;
      if (comp) return CD_COMP_DEFAULT;
      if (cls === 'UNKNOWN') return CD_UNKNOWN;   // Default (also a map with none of its own): no outline, so not white
      var c = V.schemeFill && window.cdrender ? V.schemeFill('default', window.cdrender.ROLE[cls] || 'white') : null;
      return c ? 'ff' + c.toLowerCase() : null;
    }
    // the squares of a choice in its list (the field shows its name only: bright colours there would draw the eye from the
    // map), five at most, the first at the right (row-reverse). CellDesigner and Default, fixed sets: the protein's, simple
    // molecule's, phenotype's, gene's and RNA's colours, each once; No colours one white. Original: the five colours most
    // species on the map have, the most used first, from the map as it is now (classColours keeps its last answer)
    var CD_SQ;
    function __run9() {   // run at start, in order (__start)
    CD_SQ = [['PROTEIN', 'protein'], ['SIMPLE_MOLECULE', 'simple molecule'], ['PHENOTYPE', 'phenotype'], ['GENE', 'gene'], ['RNA', 'RNA']];
    }
    function cdSquares(mode) {
      var sq = function (x, t) { return '<i style="background:#' + x.slice(2) + '" title="' + t + '"></i>'; }, h;
      if (mode === 'confetti') return confettiSquares();
      if (mode === 'none') h = sq('ffffffff', 'every species, #FFFFFF; Unknown, drawn with no outline, #DDDDDD');
      else if (mode !== 'file') {   // Custom: the classes' colours as new ones get them (kept, else the map's, else Default's)
        var seen = {};
        h = CD_SQ.map(function (q) {
          var x = (mode === 'cd' ? null : cdColourIn(mode, mode === 'custom' && shared.cd ? shared.cd.now : null, q[0])) || cdMk.LOOK[q[0]][2];
          if (seen[x]) { seen[x].push(q[1]); return null; }
          seen[x] = [q[1]]; return x;
        }).filter(Boolean).map(function (x) { return sq(x, seen[x].join(', ') + ', #' + x.slice(2).toUpperCase()); }).join('');
      } else {
        var n = shared.cd && shared.cd.now ? cdMk.classColours(shared.cd.now) : {}, w = {}, order = [];
        Object.keys(n).forEach(function (cls) { Object.keys(n[cls]).forEach(function (col) { if (!(col in w)) { w[col] = 0; order.push(col); } w[col] += n[cls][col]; }); });
        h = order.slice().sort(function (a, b) { return w[b] - w[a] || order.indexOf(a) - order.indexOf(b); }).slice(0, 5).map(function (x) { return sq(x, '#' + x.slice(2).toUpperCase() + ', ' + w[x] + ' species'); }).join('');
      }
      return '<span class="m2-cs-sw">' + h + '</span>';
    }
    function cdColsRow() { return palDrop({ key: 'cols', label: 'Colours', title: 'Colours of the map and of new species and compartments', list: CD_COLS, get: cdCols, set: function (v) { colsPick(v, cdCols(), function () { return cdMk.colours(cdNow().t); }, cdOriginal, cdRecolour); }, sq: cdSquares }); }
    function cdOriginal(r) {   // the colours kept put back (cdApply, one undo step): each alias's fill and each line (by its place, cd_make.lineKey) the record knows and the map now has otherwise; the others as they are
      var added = 0, F = r.fill || {}, L = r.line || {};
      cdApply(function (t0) {
        var now = cdMk.colours(t0);
        added = Object.keys(now.fill).filter(function (id) { return !(id in F); }).length;
        Object.keys(now.line).forEach(function (rid) { Object.keys(now.line[rid]).forEach(function (q) { if (!(L[rid] && q in L[rid])) added++; }); });
        return cdMk.recolourAll(t0, function (cls, id) { return id in F && F[id] !== now.fill[id] ? F[id] : null; },
          function (k, rid, q) { var a = L[rid]; return a && q in a && a[q] !== (now.line[rid] || {})[q] ? a[q] : null; });
      }, []);
      return added;
    }
    // a choice of Colours recolours the whole map, one undo step (cdApply): every species and compartment its colour by the
    // choice, as a new one of its class would get it (cdColourIn, from the map as it was); Original puts back the map's own
    // (colsPick); Custom a class with a kept fill, the rest as they are; Confetti every species a pastel of its own, one after
    // another (compartments as they are); a degraded species keeps CellDesigner's look. Every line black, under Confetti a
    // colour of its own (create.js confettiLine); Custom leaves the lines. One pass
    // (cd_make.recolourAll); a class CellDesigner's own colours do not know (a receptor, an ion) as it is under CellDesigner
    function cdRecolour(mode) {
      if (mode === 'file' || !shared.cd) return;
      cdApply(function (t0) {
        var lh = [];
        return cdMk.recolourAll(t0, cdFills(mode, t0), mode === 'custom' ? null : function () { return mode === 'confetti' ? confettiLine(lh) : '#000000'; });
      }, []);
    }
    function cdFills(mode, t0) {   // cd_make.recolourAll's fn under a choice: a class's fill (#rrggbb), or null to leave it
      var hues = [], kept = mode === 'custom' ? cdKept() : null;
      return function (cls) {
        var comp = cdComp(cls);
        if (mode === 'confetti') return comp ? null : confettiPick(hues);
        if (mode === 'custom') { var k = !comp && kept[cls]; return k && k.fill || null; }
        var x = cdColourIn(mode, t0, cls) || (cdMk.LOOK[cls] || [])[2];
        return x ? '#' + x.slice(2) : null;
      };
    }
    // Style: From map, the size most species of that class have on the map; Custom, the size kept by Set as default (From
    // map for a class with none); else, or none there, CellDesigner's
    function cdSize(cls) {
      if (cdComp(cls)) return cdMk.COMP.size.slice();
      var st = palStyle(), k = st === 'custom' ? cdKept()[cls] : null;
      if (k && k.w > 0 && k.h > 0) return [k.w, k.h];   // a multimer's whole box, its copies included (cdCopies)
      return (st !== 'default' && cls !== 'COMPLEX' && shared.cd && cdMk.classSize(shared.cd.now, cls)) || cdMk.LOOK[cls].slice(0, 2);
    }
    // Set as default on a CellDesigner map (PF_CD.def, the button in create.js): the species' size, fill, border width and
    // multimer kept by its class in this browser for every CellDesigner map (atlas-edit-cd-defaults, apart from SBGN-ML's
    // kinds), and Style and Colours switched to Custom: Style Custom takes the size and multimer, Colours Custom the fill
    // and border width, as on SBGN-ML maps
    var CD_DEF_KEY;
    function __run10() {   // run at start, in order (__start)
    CD_DEF_KEY = 'atlas-edit-cd-defaults';
    }
    function cdKept() { return looksKept(CD_DEF_KEY); }
    function cdDef(i) {
      var id = nodes2[i].id, L, n, all = cdKept();
      try { L = cdMk.look(shared.cd.now, id); n = cdMk.aliasInfo(shared.cd.now, id).homodimer || 1; } catch (e) { return; }   // the file behind the map read (an undo not drawn yet)
      var b = boxOf(i);
      all[L.cls] = { w: b[2], h: b[3], width: L.width, multimer: n > 1, copies: n, font: L.font };
      if (L.fill && L.cls !== 'DEGRADED') all[L.cls].fill = L.fill;   // a degraded species keeps CellDesigner's look
      if (!keepLook(CD_DEF_KEY, all)) return;
      keepMapChoice('style', 'custom'); keepMapChoice('cols', 'custom'); styleRow(); cdColsRow();
    }
    // the copies of a new species of that class: the multimer kept, under Style Custom; its box (cdSize) holds them all, the
    // front one 6 smaller for each copy behind it (cdrender frontBox; cd_make.homodimer grows the box back)
    function cdCopies(cls) { var k = palStyle() === 'custom' && cls !== 'DEGRADED' ? cdKept()[cls] : null; return k && k.multimer && k.w > 0 ? Math.max(2, k.copies || 2) : 1; }
    function cdKeptLook(t, alias, cls) {   // a new species given the border width, multimer and font size kept for its class, under Custom
      var k = cdKept()[cls], n = cdCopies(cls);
      if (!k || cls === 'DEGRADED') return t;
      if (cdCols() === 'custom' && k.width > 0 && k.width !== 1) t = cdMk.restyle(t, alias, { width: k.width });
      if (n > 1) t = cdMk.homodimer(t, alias, n);
      if (palStyle() === 'custom' && k.font > 0 && k.font !== 12) t = cdMk.restyle(t, alias, { font: k.font });   // its name's size with the size (Style)
      return t;
    }
    function cdMake(P, kind) {
      var cls = cdKind(kind);
      if (!cls || CD_GATE[kind]) return;
      // in the file's places, those of the drawing cdApply hands over (the editor's plus that drawing's shift, sh: out of
      // negative places or the canvas fit), snapped there, as the file's nodes are on its grid; placed where it is dropped,
      // also past the canvas's edge: drawing it shifts the map (cd_edit.place) and the frame follows, as after a move, so
      // nothing moves on screen
      var s = cdSize(cls), e = cdComp(cls) ? 0 : 6 * (cdCopies(cls) - 1);
      var boxAt = function (sh) {   // centred and snapped by the whole box, a multimer's copies included
        var X = P[0] + sh[0] - s[0] / 2, Y2 = P[1] + sh[1] - s[1] / 2;
        if (gridSet.snap) { X += toGrid(X + s[0] / 2, gridSet.step); Y2 += toGrid(Y2 + s[1] / 2, gridSet.step); }
        return [+fmt(X), +fmt(Y2), s[0] - e, s[1] - e];   // the front one: homodimer adds the copies
      };
      // a species placed on a complex is its member (an included species, cd_make), the complex packed round it in the same
      // undo step; a phenotype or a degraded species not (CellDesigner keeps neither in a complex)
      var cx = !cdComp(cls) && !/^(PHENOTYPE|DEGRADED)$/.test(cls) ? cdComplexAt(P) : null, made = null;
      var ok = cdApply(function (t, sh) {
        var b = boxAt(sh), r = cdComp(cls) ? cdMk.compartment(t, { name: '', box: b, oval: cls === 'OVAL', colour: cdColour(t, cls) }) : cdMk.species(t, { cls: cls, name: '', box: b, complex: cx, colour: cdColour(t, cls) });
        made = r.alias; return cdComp(cls) ? r.text : cdKeptLook(r.text, r.alias, cls);
      }, function () { return [made]; });
      if (ok && cx) joinPack([cx]);
    }

    // a gate by three clicks: its inputs (two for AND and OR, one for NOT and the unknown gate), then
    // the reaction's square, or the target entity in reduced notation; the inputs marked as they are clicked
    function cdGateClick(P) {
      var kind = CD_GATE[tool.kind], i = linkEnd(P, -1), r = i >= 0 ? cdRole(i) : null;
      if (!shared.cdGate || shared.cdGate.kind !== kind) shared.cdGate = { kind: kind, inputs: [] };
      var need = cdMk.NEED[kind];
      if (shared.cdGate.inputs.length < need) {
        if (r !== 'epn' || shared.cdGate.inputs.indexOf(nodes2[i].id) >= 0) return;   // a click the gate cannot take does nothing: the marks show what it can (cdGateOk)
        shared.cdGate.inputs.push(nodes2[i].id);
        paint();
        return;
      }
      if (r !== 'proc' && (r !== 'epn' || cdStrict())) return;   // the same: a species only in reduced notation
      var g = shared.cdGate, target = r === 'proc' ? cdRid(i) : nodes2[i].id, out = null, L = cdGateLand(i, P) || {};   // where its line out lands, as shown
      // refused (nothing said), the inputs clicked stay for another target
      if (!cdApply(function (t) { var q = cdMk.gate(t, { kind: g.kind, inputs: g.inputs, target: target, spot: L.spot, toAt: L.at }); out = q.gate; return q.text; },
        function () { return [/\|m\d+$/.test(out) ? out.replace(/\|m(\d+)$/, '|g$1') : out + '|g']; })) return;   // the gate selected: Delete takes it back
      shared.cdGate = null;
      if (tool && !tool.sticky) palTake(null);
    }
    // Marks while a CellDesigner line is made, as CellDesigner shows them: what is picked (a gate's inputs clicked so far)
    // as selected, its outline and handles in magenta with a magenta dot at the port its line takes (the centre); the node
    // the next click or the line's end would land on with a dashed box, grey handles and a blue square at the port it
    // would take. In the map's units, so they follow the zoom as the other marks
    var cdHover;
    function __run12() {   // run at start, in order (__start)
    cdHover = null;
    }   // { id, P }: the node a gate's next click would take, under the pointer at P
    function cdHandles(i, cls) { return handleMarks(bx(i), cls); }
    function cdDot(Q, cls) { var d = Math.max(3, 4 * V.z); return '<rect class="' + cls + '" x="' + f1(sx(Q[0]) - d / 2) + '" y="' + f1(sy(Q[1]) - d / 2) + '" width="' + f1(d) + '" height="' + f1(d) + '"/>'; }
    function cdCentre(i) { var b = bx(i); return [b[0] + b[2] / 2, b[1] + b[3] / 2]; }
    function cdPicked(out, i) {   // a node picked: magenta outline, handles and the centre's dot
      out.push('<g transform="translate(' + f1(V.tx - x0 * V.z) + ',' + f1(V.ty - y0 * V.z) + ') scale(' + V.z + ')"><path class="m2-ed-pick" stroke-width="' + f1(1 / Math.max(V.z, 0.01)) + '" d="' + shapeD(i) + '"/></g>');
      out.push(cdHandles(i, 'm2-ed-pickh') + cdDot(cdCentre(i), 'm2-ed-pickh'));
    }
    function cdLand(out, i, L) {   // the node a line would land on: dashed box, grey handles, its places (landMarks, core.js), the one it would take filled
      var b = bx(i), off = 3.3 * V.z;
      out.push('<rect class="m2-ed-landbox" x="' + f1(sx(b[0]) - off) + '" y="' + f1(sy(b[1]) - off) + '" width="' + f1(b[2] * V.z + 2 * off) + '" height="' + f1(b[3] * V.z + 2 * off) + '"/>');
      out.push(cdHandles(i, 'm2-ed-landh') + landMarks((L && L.all) || [], (L && L.Q) || cdCentre(i)));
    }
    function cdGateOk(i) {   // whether a gate's next click would take node i
      if (i < 0) return false;
      var r = cdRole(i), need = cdMk.NEED[CD_GATE[tool.kind]], got = shared.cdGate && shared.cdGate.kind === CD_GATE[tool.kind] ? shared.cdGate.inputs : [];
      if (got.length < need) return r === 'epn' && got.indexOf(nodes2[i].id) < 0;
      return r === 'proc' || (r === 'epn' && !cdStrict());
    }
    function cdGateLand(i, P) {   // where the gate's line out lands on its target i: a reaction's square or a species' place
      var r = cdRole(i);
      return r === 'proc' ? cdPort(i, P, { mod: true }) : r === 'epn' ? cdPort(i, P, { red: true }) : null;
    }
    function __run13() {   // run at start, in order (__start)
    V.view.addEventListener('pointermove', function (e) {
      var on_ = cdPal() && tool && CD_GATE[tool.kind] && !e.buttons, P = on_ ? at(e) : null, i = on_ ? linkEnd(P, -1) : -1;
      if (on_ && !cdGateOk(i)) i = -1;
      var h = i >= 0 ? { id: nodes2[i].id, P: P } : null, was = cdHover;   // by id: a re-parse (an undo, the gate made) renumbers nodes2
      cdHover = h;
      var q = function (x) { if (!x) return ''; var k = nodes2.findIndex(function (n) { return n.id === x.id; }), L = k >= 0 && cdGateLand0(k, x.P); return x.id + (L ? (L.at || '') + (L.spot || '') : ''); };
      if (q(was) !== q(h)) paint();   // only when the node or its blue place changes
    });
    }
    function cdGateLand0(k, P) { var need = cdMk.NEED[CD_GATE[tool.kind]], got = shared.cdGate && shared.cdGate.kind === CD_GATE[tool.kind] ? shared.cdGate.inputs.length : 0; return got >= need ? cdGateLand(k, P) : null; }
    function __run14() {   // run at start, in order (__start)
    V.view.addEventListener('pointerleave', function () { if (cdHover) { cdHover = null; paint(); } });
    }
    function cdGateMarks(out) {   // a gate being made by clicks (paint, core.js through linkPaint): its inputs picked, the next click's node
      if (!tool || !CD_GATE[tool.kind] || !cdPal()) { shared.cdGate = null; cdHover = null; return; }
      if (shared.cdGate && CD_GATE[tool.kind] !== shared.cdGate.kind) shared.cdGate = null;
      if (shared.cdGate) shared.cdGate.inputs.forEach(function (id) { var i = nodes2.findIndex(function (n) { return n.id === id; }); if (i >= 0) cdPicked(out, i); });
      var k = cdHover ? nodes2.findIndex(function (n) { return n.id === cdHover.id; }) : -1;
      if (k >= 0 && cdGateOk(k)) cdLand(out, k, cdGateLand0(k, cdHover.P));
    }
    function cdLinkMarks(out) {   // a line drawn by a drag on a CellDesigner map: its start picked, the node it would land on
      var add = cdAdd(), no = link.how && link.how.no, part = !no && link.how && link.how.part;
      var rx = !(add || part) || no ? -1 : cdRole(link.from) === 'proc' ? link.from : link.to >= 0 && cdRole(link.to) === 'proc' ? link.to : -1;
      if (rx >= 0) cdMainLine(out, rx);   // a reactant or product being added: the reaction it joins, its main line in blue
      if (cdFromJoin()) {   // from a reaction: the product's join in magenta (the reaction itself not picked); no arrowhead until it is made, as every live line
        var J = cdJoin(link.from, false);
        out.push(cdDot(J || cdCentre(link.from), 'm2-ed-pickh'));
      } else cdPicked(out, link.from);
      if (link.to < 0 || !link.how || no) return;
      if (rx === link.to) out.push(landMarks([], (link.how.land && link.how.land.Q) || cdCentre(link.to)));   // an added reactant joins the main line, not the square: its join only, no box or handles on the square
      else cdLand(out, link.to, link.how.land);
    }
    // Add product picked: the join a press would start from, shown while the pointer is over a reaction's square or near
    // its main line (cdLineAt), so the drag starts there without aiming at the square
    var cdOver;
    function __run15() {   // run at start, in order (__start)
    cdOver = null;   // the square's id (a re-parse, an undo, renumbers nodes2)
    V.view.addEventListener('pointermove', function (e) {
      var on_ = cdPal() && cdAdd() === 'p' && !e.buttons && !link, i = on_ ? linkEnd(at(e), -1) : -1, id = i >= 0 && cdRole(i) === 'proc' ? nodes2[i].id : null;
      if (id !== cdOver) { cdOver = id; paint(); }
    });
    V.view.addEventListener('pointerleave', function () { if (cdOver) { cdOver = null; paint(); } });
    }
    function cdOverMarks(out) {
      var i = cdOver && cdPal() && !link && cdAdd() === 'p' ? nodes2.findIndex(function (n) { return n.id === cdOver; }) : -1;
      if (i < 0) { cdOver = null; return; }
      cdMainLine(out, i);
      var J = cdJoin(i, false);
      if (J) out.push(cdDot(J, 'm2-ed-pickh'));
    }
    // Add reactant and Add product (CellDesigner's Add Reactant and Add Product): a line joined to a reaction already
    // there. The reaction is taken by its square or its main line: an added reactant joins at 3/8 of the square's
    // segment, an added product leaves at 5/8 (cdrender linksAndModifiers, cd_edit)
    function cdAdd() { var k = tool && cdKind(tool.kind); return k === 'ADD_REACTANT' ? 'r' : k === 'ADD_PRODUCT' ? 'p' : null; }
    function cdFree() { return !!tool && !!ARCS[tool.kind] && tool.sticky; }   // a line's sign kept in hand: forgiving drawing (cdHow0)
    function cdFromJoin() { return cdAdd() === 'p' || (cdFree() && cdRole(link.from) === 'proc'); }   // a line from a reaction: an added product, from its join
    function cdOnLine() { return !!cdAdd() || cdFree(); }   // a press on a reaction's main line starts a line (cdLineAt)
    function cdStartOk(i) {   // whether a line may start from node i with the sign picked (linkDown, create.js)
      var r = cdRole(i), add = cdAdd();
      return r !== 'gate' && (cdFree() || (add === 'r' ? r === 'epn' : add === 'p' ? r === 'proc' : true));
    }
    function cdMain(i) {   // the main line of the reaction whose square is node i: the edges into and out of its square
      return edges2.map(function (e, k) { return (e.t === i && /\|a$/.test(e.id)) || (e.s === i && /\|b$/.test(e.id)) ? k : -1; }).filter(function (k) { return k >= 0; });
    }
    function cdJoin(i, into) {   // where an added reactant (into) or product meets the main line, in the map's units; null when unknown
      var ka = edges2.findIndex(function (e) { return e.t === i && /\|a$/.test(e.id); });
      if (ka < 0) return null;
      var p = ports(ka), A = p[p.length - 2], C = p[p.length - 1];
      if (p.length === 2 && edges2[ka].s != null) A = cutShape(edges2[ka].s, A, C, bx(edges2[ka].s));   // no bend: the segment starts at the reactant's outline
      var t = into ? 0.75 : 1.25;   // 3/8 and 5/8 of the segment, the square at its middle
      return [A[0] + t * (C[0] - A[0]), A[1] + t * (C[1] - A[1])];
    }
    function cdMainLine(out, i) {
      cdMain(i).forEach(function (k) {
        var p = line(k);
        if (p) out.push('<path class="m2-ed-rxline" stroke-width="' + f1(Math.max(1.5, 1.5 * V.z)) + '" d="M' + p.map(function (q) { return f1(sx(q[0])) + ' ' + f1(sy(q[1])); }).join('L') + '"/>');
      });
    }
    // with Add reactant or Add product picked, a press or a release near a reaction's main line takes its square (linkEnd,
    // create.js, when no node is under P): within 5 pixels of the line, as a click takes a line (hit, core.js)
    function cdLineAt(P, not) {
      if (!cdOnLine()) return -1;
      var R = 5 / V.z, best = -1, bd = Infinity;
      edges2.forEach(function (e, k) {
        var i = /\|a$/.test(e.id) ? e.t : /\|b$/.test(e.id) ? e.s : null;
        if (i == null || i === not || cdRole(i) !== 'proc') return;
        var p = line(k);
        for (var j = 1; p && j < p.length; j++) { var d = near(P, p[j - 1], p[j]); if (d <= R && d < bd) { bd = d; best = i; } }
      });
      return best;
    }
    // the line being drawn (linkPaint, create.js; C: its start node's centre): an added reactant from where the line to
    // its join leaves the species, to the join; an added product from its join to the place it would take on the species
    function cdLiveEnds(S, P, C) {
      var h = link.how, ok = h && !h.no, J;
      if (ok && h.part === 'reactant' && h.land && h.land.Q) { J = h.land.Q; return [cutShape(link.from, C, J, bx(link.from)), J]; }
      if ((ok ? h.part === 'product' : !h && cdFromJoin()) && (J = cdJoin(link.from, false))) return [J, ok && h.land && h.land.Q ? cutShape(link.to, h.land.Q, J, bx(link.to)) : P];   // over nothing yet: from the join to the pointer
      return [S, P];
    }
    // the map clicked with a CellDesigner sign in hand (palUp, create.js)
    function cdClick(P) { if (CD_GATE[tool.kind]) cdGateClick(P); else cdMake(P, tool.kind); }

    // a line drawn by a drag from a node with a line's sign picked (create.js linkDown, linkHow, linkMake). A reaction
    // sign: species to species that reaction. Add reactant: a species onto a reaction an added reactant, onto a gate a new
    // input. Add product: a reaction to a species an added product. A
    // modifier picked: a species onto a square, or species to species its reduced notation type (the tick box ticked)
    // what a line from a to b makes (cdHow0), with where its end would land when let go at P (land: { Q, at, spot },
    // shown by cdLand and written by cdLink)
    function cdHow(a, b, P) { var h = cdHow0(a, b, P); if (h && !h.no && P) h.land = cdPort(b, P, h); return h; }
    // where an end let go at P lands on node i. A species, for a reaction's or reduced line's product end or an added
    // product: one of CellDesigner's 16 places (cdrender anchorAt, its one master), the nearest to P, or the centre while
    // P is in the middle half of the box. A reaction's square, for a modifier: the nearest of its six places, turned with
    // the main line (cdrender SQUARE's order, 2 to 7). Anything else: the centre
    var cdClsMemo;
    function __run16() {   // run at start, in order (__start)
    cdClsMemo = { t: null, cls: {}, about: {} };
    }
    function cdMemo() { var t = shared.cd.now; if (cdClsMemo.t !== t) cdClsMemo = { t: t, cls: {}, about: {} }; return cdClsMemo; }   // read once per file: a species' class (cdClsOf), a reaction (cdAbout)
    function cdClsOf(id) {
      var M = cdMemo();
      if (!(id in M.cls)) { try { var A = cdMk.aliasInfo(M.t, id); M.cls[id] = A.cls && [A.cls, A.homodimer || 1]; } catch (e) { M.cls[id] = null; } }
      return M.cls[id];
    }
    function cdPort(i, P, how) {   // all: every place offered, for the marks (cdLand)
      var b = bx(i), C = [b[0] + b[2] / 2, b[1] + b[3] / 2], best = null, bd = Infinity, all = [];
      var near = function (Q, o) { all.push(Q); var d = Math.hypot(Q[0] - P[0], Q[1] - P[1]); if (d < bd) { bd = d; best = o; o.Q = Q; } };
      if (how.mod && cdRole(i) === 'proc') {   // procPlaces (core.js): the six places in cdrender SQUARE's order, 2 to 7
        var S = procPlaces(i);
        if (!S) return { Q: C };
        S.forEach(function (o, k) { near([C[0] + o[0], C[1] + o[1]], { spot: k + 2 }); });
        best.all = all;
        return best;
      }
      if (how.part === 'reactant' && cdRole(i) === 'proc') { var J = cdJoin(i, true); return J ? { Q: J, all: [J] } : { Q: C }; }   // an added reactant: its join on the main line
      var N = how.rx || how.red || how.part === 'product' ? nodePlaces(i) : null;   // a species' 16 places (celldesigner.js)
      if (!N) return { Q: C };
      N.forEach(function (o) { near([C[0] + o[0], C[1] + o[1]], { at: o[2] }); });
      all.push(C);
      if (nodeCentre(i, P)) return { Q: C, all: all };
      best.all = all;
      return best;
    }
    // a line's sign kept in hand draws forgivingly (as linkHow): the kind picked where it fits, else the kind the ends
    // give, silently; never a new reaction for a modifier picked between two species (Reduced notation unticked); a
    // catalysis between species a physical stimulation in reduced notation where it is ticked
    function cdHow0(a, b, P) {
      var want = tool && ARCS[tool.kind] ? cdKind(tool.kind) : null, h = cdKindOk(a, b, P, want), g;
      if (h && h.no && want && tool.sticky && (g = cdKindOk(a, b, P, null)) && !g.no && !(g.rx && cdMk.MODS.indexOf(want) >= 0)) return g;
      if (h && h.no && want === 'CATALYSIS' && tool.sticky && (g = cdKindOk(a, b, P, 'PHYSICAL_STIMULATION')) && !g.no) return g;   // between species a reduced physical stimulation, an activation
      return h;
    }
    function cdKindOk(a, b, P, want) {   // cdKind0's kind for the gesture, then the rules table's answer for it (cdSays)
      var h = cdKind0(a, b, P, want), m = h && !h.no && cdSays(h, a, b);
      return m ? { no: m } : h;
    }
    // ---------- the rules table (notation.js) on a CellDesigner map, the same rows as on the SBGN maps (create.js ruleSays) ----------
    // A node's kind by its CellDesigner class (a species', a gate's type; a reaction's square a process, as is -1, the
    // reaction a line between two species makes); the sets: PD, with reduced notation where the Reduced notation tick box
    // is ticked; the checks answered from the reaction in the file. A node with no kind is left to cdKind0 and takes0
    function cdAbout(rid) {   // cd_make.about of a reaction, once per file (takes asks it for every node under the pointer)
      var M = cdMemo();
      if (!(rid in M.about)) { try { M.about[rid] = cdMk.about(M.t, rid); } catch (e) { M.about[rid] = null; } }
      return M.about[rid];
    }
    function cdGateOf(i) {   // a gate's type and inputs: a modifier's gate by its number, a gate between species its reaction's
      var m = nodes2[i].id.match(/^(.*)\|g(\d*)$/), A = m && cdAbout(m[1]);
      return !A ? null : m[2] ? A.gates[+m[2]] : A.gate && { kind: A.gate.kind, inputs: A.inputs || [] };
    }
    function cdNt(i) {
      var r = i < 0 ? 'proc' : cdRole(i), c;
      if (r === 'proc') return { kind: 'process', cls: 'process' };
      if (r === 'gate') { var g = cdGateOf(i); return g ? NT.nodeKind('celldesigner', 'BOOLEAN_LOGIC_GATE_' + g.kind) : null; }
      return r === 'epn' && (c = cdClsOf(nodes2[i].id)) ? NT.nodeKind('celldesigner', c[0]) : null;
    }
    // the table's answer for a line of class cls from s to t; held: the line being moved is a reduced notation reaction
    function cdAsk(cls, s, t, held) {
      var ks = cdNt(s), kt = cdNt(t);
      if (!ks || !kt) return null;
      return NT.allowed(cls, ks, kt, { sets: ['pd'].concat(cdStrict() ? [] : ['reduced']), held: !!held, check: function (c) {
        if (c === 'oneInput') { var g = cdGateOf(t); return g && g.inputs && g.inputs.length ? 'A NOT gate has one input, and this one has it.' : null; }
        if (c === 'already' && t >= 0 && cdRole(t) === 'proc' && NT.MODS.indexOf(cls) >= 0) {   // the same modifier of the same species on that reaction
          var A = cdAbout(cdRid(t)), al = nodes2[s].id;
          return A && A.mods.some(function (type, j) { return NT.arcKind('celldesigner', type) === cls && A.modAliases[j] === al; }) ? 'This ' + cls + ' is there already.' : null;
        }
        return null;   // a gate's one line out is made with it; CellDesigner checks no reversible reaction
      } });
    }
    function cdSays(h, a, b) {   // cdKind0's answer h for a line from a to b, put to the table
      if (h.rx) return cdAsk('consumption', a, -1) || cdAsk('production', -1, b);
      if (h.red) return cdAsk(NT.arcKind('celldesigner', h.red), a, b);
      if (h.gate) return cdAsk('logic arc', a, b);
      if (h.mod) return cdAsk(NT.arcKind('celldesigner', h.mod), a, b);
      if (h.part) return h.part === 'reactant' ? cdAsk('consumption', a, b) : cdAsk('production', a, b);
      return null;
    }
    // an end of line k dragged onto species i (core.js takes, after takes0, which keeps a gate's lines and a reaction's
    // square in place): the table's answer for the line as it would be. A reduced notation reaction asked between its two
    // species; any other reaction drawn without a square (cd_edit FULL: a transcriptional activation, a heterodimer
    // association, ...) left as it is, the table having no kind for its single line
    function cdMoveSays(k, end, i) {
      var e = edges2[k], m = e.id.match(/^(.*)\|(a|b|[rpm])(\d*)$/), A = m && cdAbout(m[1]);
      if (!A) return null;
      var sq = nodes2.some(function (n) { return n.id === m[1] + '|proc'; });
      if (!sq) {
        if (!NT.reducedType('celldesigner', A.type)) return null;
        var ea = edges2.filter(function (q) { return q.id === m[1] + '|a'; })[0], eb = edges2.filter(function (q) { return q.id === m[1] + '|b'; })[0];
        var was = end ? e.t : e.s, ends = [ea ? ea.s : null, eb ? eb.t : ea ? ea.t : null].map(function (x) { return x === was ? i : x; });
        if (ends[0] == null || ends[1] == null) return null;
        var pic = function (x) { var q = cdNt(x); return !!q && q.kind === 'phenotype'; };   // held while its source stays the same sort (a species; a phenotype)
        return cdAsk(NT.arcKind('celldesigner', A.type), ends[0], ends[1], !ea || pic(ea.s) === pic(ends[0]));
      }
      var cls = m[2] === 'm' ? NT.arcKind('celldesigner', A.mods[+m[3]]) : /^[ar]$/.test(m[2]) ? 'consumption' : 'production';   // a modifier: its species' end (a gate's line stays, takes0)
      return cls ? cdAsk(cls, end ? e.s : i, end ? i : e.t) : null;
    }
    function cdKind0(a, b, P, want) {
      if (b < 0) return null;
      var ra = cdRole(a), rb = cdRole(b), line = !want;   // no kind picked: the ends give it
      var isRx = want && CD_RX.some(function (q) { return q[0] === want; }), isMod = want && cdMk.MODS.indexOf(want) >= 0;
      var add = want === 'ADD_REACTANT' ? 'r' : want === 'ADD_PRODUCT' ? 'p' : null;
      if (!rb) return { no: 'A line joins species, a reaction’s square or a logic gate: never a compartment or a complex’s member.' };
      if (ra === 'gate') return { no: 'A logic gate has one line out, made with the gate.' };
      if (rb === 'gate') {
        if (ra !== 'epn') return { no: 'A logic gate’s inputs are species.' };
        return add === 'r' || line ? { gate: true } : { no: 'A new input of a logic gate is drawn with Add reactant.' };
      }
      if (ra === 'proc' && rb === 'proc') return { no: 'A line does not join two reactions.' };
      if (add === 'r') return ra === 'epn' && rb === 'proc' ? { part: 'reactant' } : { no: 'Add reactant goes from a species onto a reaction (its square or its main line) or onto a logic gate.' };
      if (add === 'p') return ra === 'proc' && rb === 'epn' ? { part: 'product' } : { no: 'Add product goes from a reaction (its square or its main line) to a species.' };
      if (line && ra === 'proc') return { part: 'product' };
      if (line && rb === 'proc') return onSquare(b, P) ? { mod: cdUsual(b) } : { part: 'reactant' };   // the square a modifier, the main line a reactant
      if (ra === 'proc') return isMod ? { no: 'A ' + CD_NAME[want].toLowerCase() + ' goes from a species.' } : { no: 'A product added to a reaction is drawn with Add product.' };
      if (rb === 'proc') {
        return isRx ? { no: 'A reactant added to a reaction is drawn with Add reactant; a reaction’s sign makes a new reaction between two species.' } : { mod: want || 'CATALYSIS' };
      }
      if (isMod) {   // between species: its reduced notation type, with the tick box ticked
        if (!RED_OF[want]) return { no: 'CellDesigner has no catalysis between species: it ends on a reaction’s square (between species, physical stimulation).' };
        return cdStrict() ? { no: 'A ' + CD_NAME[want].toLowerCase() + ' between species is reduced notation, unticked in the palette; it ends on a reaction’s square.' } : { red: RED_OF[want] };
      }
      return { rx: want || 'STATE_TRANSITION' };
    }
    // a line let go at P on reaction i: on its square (linkEnd's box test, the same margin), not on its main line (cdLineAt)
    function onSquare(i, P) { var b = bx(i), R = 4 / V.z; return !P || (P[0] >= b[0] - R && P[0] <= b[0] + b[2] + R && P[1] >= b[1] - R && P[1] <= b[1] + b[3] + R); }
    // the modifier the Line sign makes on reaction i: the one most used on the map, ties in the palette's order; on a map
    // with none, a catalysis on a reaction with a simple molecule or ion among its reactants, else a physical stimulation
    var cdUsualMemo;
    function __run17() {   // run at start, in order (__start)
    cdUsualMemo = [null, null, {}];
    }   // the file read, its most used modifier, the metabolic test per reaction: once per file, not per pointer move
    function cdUsual(i) {
      if (cdUsualMemo[0] !== shared.cd.now) {
        var n = {}, best = null, most = 0, m, re = /<celldesigner:modification\b[^>]*?\btype="([A-Z_]+)"/g;
        while ((m = re.exec(shared.cd.now))) n[m[1]] = (n[m[1]] || 0) + 1;
        CD_MOD.forEach(function (q) { if (n[q[0]] > most) { most = n[q[0]]; best = q[0]; } });
        cdUsualMemo = [shared.cd.now, best, {}];
      }
      var rid = cdRid(i), met = cdUsualMemo[2];
      if (!(rid in met)) met[rid] = cdMetabolic(rid);
      return cdUsualMemo[1] || (met[rid] ? 'CATALYSIS' : 'PHYSICAL_STIMULATION');
    }
    function cdMetabolic(rid) {
      var esc = function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
      var r = shared.cd.now.match(new RegExp('<reaction\\b[^>]*\\bid="' + esc(rid) + '"[\\s\\S]*?</reaction>'));
      if (!r) return false;
      var ids = [], m, re = /<celldesigner:(?:baseReactant\b[^>]*?\bspecies|reactantLink\b[^>]*?\breactant)="([^"]+)"/g;
      while ((m = re.exec(r[0]))) ids.push(m[1]);
      return ids.some(function (s) {
        var sp = shared.cd.now.match(new RegExp('<species\\b[^>]*\\bid="' + esc(s) + '"[\\s\\S]*?</species>'));
        return sp && /<celldesigner:class>(SIMPLE_MOLECULE|ION)</.test(sp[0]);
      });
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
        if (line && cdCols() === 'confetti') { try { return cdMk.recolourLine(q.text, /\|/.test(line) ? line : line + '|a', confettiLine(confettiHues(q.text))); } catch (e) { if (!(e && e.refused)) throw e; } }   // a new line a colour of its own, as the map's
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
      var t0 = shared.cd.now;
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
    function __run18() {   // run at start, in order (__start)
    document.addEventListener('keydown', function (e) {
      if ((e.key !== 'Delete' && e.key !== 'Backspace') || !cdPal() || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if ((shared.selN.length || (shared.selE.length && !shared.selP.length)) && cdDelete(shared.selN, shared.selE)) { e.preventDefault(); e.stopImmediatePropagation(); }   // an area's bend points go with their lines, as the menu's Delete
    }, true);
    }
    function cdDeleteItem() {   // the right-click menu's Delete over a state variable, a unit of information, a node or a line
      if (!rclick) return null;
      var sq = svAt(rclick);
      if (sq) return function () { shared.svSel = { id: nodes2[sq[0]].id, j: sq[1] }; svDelete(); };
      var h = hit(rclick);
      if (h && h.n != null) { var i = h.n; return function () { cdDelete(shared.selN.indexOf(i) >= 0 ? shared.selN : [i], shared.selN.indexOf(i) >= 0 ? shared.selE : []); }; }
      if (h && h.e != null && h.p == null) { var k = h.e; return function () { var all = shared.selE.indexOf(k) >= 0; cdDelete(all ? shared.selN : [], all ? shared.selE : [k]); }; }   // over the selection: all of it
      return null;
    }
    // the right-click menu over a species, a line or a gate: its other kinds within the palette's
    function cdItems() {
      if (!rclick) return null;
      var sq = svAt(rclick);
      if (sq) return cdSvOwnItems(sq);   // a state variable or unit of information: its own menu
      var h = hit(rclick), out = [];
      if (h && h.n != null) {
        var i = h.n, r = cdRole(i), id = nodes2[i].id;
        if (r === 'gate') {
          var g = cdMk.about(shared.cd.now, cdRid(i)), m = id.match(/\|g(\d+)$/), now = m ? g.gates[+m[1]] : g.gate;
          if (!now) return null;
          var nin = m ? now.inputs.length : (g.inputs || []).length;
          CD_GATES.forEach(function (q) {
            if (q[0] !== now.kind && !(q[0] === 'NOT' && nin > 1) && nin >= cdMk.NEED[q[0]]) out.push(['Make ' + q[1], function () { cdApply(function (t) { return cdMk.gateType(t, cdGateRef(i), { kind: q[0] }); }, [id]); }]);
          });
          return out;
        }
        if (r === 'proc') return cdRxItems(cdRid(i));
        var A = cdMk.aliasInfo(shared.cd.now, id);
        if (!A.cls) return null;
        out = cdSvItems(id, A);   // first, as on SBGN-ML maps: Add state variable, Add structural state, Add unit of information
        if (A.cls === 'COMPLEX') return out.length ? out : null;
        out.push(['Change identity', subItem(function (r, done) { return cdIdentity(id, r, done); })]);
        // after it, the species' homodimer, as Properties' Multimer (2 when made, 1 back)
        if (A.cls !== 'DEGRADED') out.push([A.homodimer > 1 ? 'Make monomer' : 'Make multimer', function () { cdApply(function (t) { return A.homodimer > 1 ? cdMk.homodimer(t, id, 1) : cdTopClear(cdMk.homodimer(t, id, 2), id, true); }, [id]); }]);
        out.late = true;   // rarely used: after the common items, above Delete
        return out;
      }
      if (h && h.e != null && h.p == null) {
        var ln = edges2[h.e], mm = ln.id.match(/^(.*)\|(a|b|m\d+)$/);
        if (!mm || (ln.t != null && cdRole(ln.t) === 'gate')) return null;   // a gate's input: nothing to change on it
        if (ln.s != null && cdRole(ln.s) === 'gate') {   // a gate's line out: its other output types (a modifier's on a reaction, reduced notation's between species)
          var gs = ln.s, gref = cdGateRef(gs), ga = cdMk.about(shared.cd.now, cdRid(gs)), gm = nodes2[gs].id.match(/\|g(\d+)$/), gw = gm ? ga.gates[+gm[1]] : ga.gate;
          if (!gw) return null;
          return cdModIdentity(gm ? CD_MODS : CD_RED, gw.out, function (k) { cdApply(function (t) { return cdMk.gateType(t, gref, { output: k }); }, [nodes2[gs].id]); });
        }
        if (mm[2][0] !== 'm') return cdRxItems(mm[1]);
        var n = +mm[2].slice(1), ab = cdMk.about(shared.cd.now, mm[1]), was = ab.mods[n];
        if (cdMk.MODS.indexOf(was) < 0) return null;   // a gate's own line: its gate's menu
        return cdModIdentity(CD_MODS, was, function (k) { cdApply(function (t) { return cdMk.modifierType(t, mm[1], n, k); }, [], [mm[1] + '|m' + n]); });
      }
      return null;
    }
    // Change identity (core.js kindWindow): a species' kinds, the palette's names, no complex or compartment (a
    // complex and a single species are not changed into one another), none a complex cannot hold for its member (phenotype,
    // degraded); a click retypes it (cd_make.retype, its colour following the scheme), one undo step
    function cdIdentity(id, r, done) {
      var A = cdMk.aliasInfo(shared.cd.now, id);
      if (!A.cls) return null;
      return kindWindow(r, CD_SP.filter(function (q) { return q[0] !== 'COMPLEX' && !cdComp(q[0]) && !(A.complex && /^(PHENOTYPE|DEGRADED)$/.test(q[0])); }).map(function (q) {
        return { name: q[1], own: q[0] === A.cls, go: function () { cdApply(function (t) { return cdMk.retype(t, id, q[0], { from: cdColour(t, A.cls), to: cdColour(t, q[0]) }); }, [id]); } };
      }), done);
    }
    // a modulation's kinds (a modifier on a reaction: the five; reduced notation between species: its four, no catalysis),
    // each by the modifier's sign and name; set: [[type, modifier type]], go(type) writes it
    function cdModIdentity(set, was, go) {
      return lateItem(['Change identity', subItem(function (r, done) {
        return kindWindow(r, set.map(function (q) { return { name: CD_NAME[q[1]], own: q[0] === was, go: function () { go(q[0]); } }; }), done);
      })]);
    }
    var CD_MODS;
    function __run19() {   // run at start, in order (__start)
    CD_MODS = CD_MOD.map(function (q) { return [q[0], q[0]]; });
    }   // a modifier's types, each its own sign
    function cdRxItems(rid) {   // a reaction's other types: a process's among the three; reduced notation (a modulation) by Change identity
      var ab = cdMk.about(shared.cd.now, rid), set = cdMk.PROCESS.indexOf(ab.type) >= 0 ? CD_RX : null;
      if (cdMk.REDUCED.indexOf(ab.type) >= 0) return cdModIdentity(CD_RED, ab.type, function (k) { cdApply(function (t) { return cdMk.reactionType(t, rid, k); }, [], [rid]); });
      if (ab.reversible === null) return null;
      // its other types by Change identity (core.js kindWindow), as a species' and a modifier's; then reversible or not
      var out = set ? [['Change identity', subItem(function (r, done) {
        return kindWindow(r, set.map(function (q) { return { name: q[1], own: q[0] === ab.type, go: function () { cdApply(function (t) { return cdMk.reactionType(t, rid, q[0]); }, [], [rid]); } }; }), done);
      })]] : [];
      out.push([ab.reversible ? 'Make irreversible' : 'Make reversible', function () { cdReversible(rid, !ab.reversible); }]);
      out.late = true;   // rarely used: after the common items, above Delete
      return out;
    }
    // reversible or not (cd_make.reversible; about() null where a reaction may not be): also the Reversible tick box in
    // Properties, for one reaction selected (its lines or its square, nothing else); true when written
    function cdReversible(rid, on) { return cdApply(function (t) { return cdMk.reversible(t, rid, on); }, [], [rid]); }
    var cdRxSeen;
    function __run20() {   // run at start, in order (__start)
    cdRxSeen = [null, null];
    }   // [rid and file, reversible or null]: read once per selection and change (Properties runs with every paint)
    function cdRxOf() {   // { rid, on } of the one reaction selected that may be reversible, else null
      if (!shared.cd || shared.selP.length || shared.svSel || (!shared.selE.length && !shared.selN.length)) return null;
      if (shared.selE.length === 1 && !shared.selN.length && edges2[shared.selE[0]] && /\|[rp]\d+$/.test(edges2[shared.selE[0]].id)) return null;   // an added reactant or product alone: its own line's Properties
      var rid = null, ok = true;
      shared.selE.forEach(function (k) { var m = edges2[k] && edges2[k].id.match(/^(.*)\|(a|b|r\d+|p\d+)$/); if (!m || (rid && rid !== m[1])) ok = false; else rid = m[1]; });
      shared.selN.forEach(function (i) { var m = nodes2[i] && nodes2[i].id.match(/^(.*)\|proc$/); if (!m || (rid && rid !== m[1])) ok = false; else rid = m[1]; });
      if (!ok || !rid) return null;
      var key = rid + '\u0000' + shared.cd.now;
      if (cdRxSeen[0] !== key) { var ab = null; try { ab = cdMk.about(shared.cd.now, rid); } catch (e) { ab = null; } cdRxSeen = [key, ab ? ab.reversible : null]; }
      return cdRxSeen[1] === null ? null : { rid: rid, on: cdRxSeen[1] };
    }
    // a compartment's name dragged by itself (its drawn text pressed, in Full editing): it follows the pointer from one
    // of nine places to the next (cdrender NAME_PLACES, namePoint: just inside the inner line), the nearest to where the
    // name would be, and is written there on release (cd_make.nameAt, one undo step); a press with no move selects the
    // compartment, as a click on it does, and a double click still opens the name. Reached through svDown (create.js),
    // which the core asks before a node is pressed
    var cdNm, cdCardDrag, cdCard;
    function __run21() {   // run at start, in order (__start)
    cdNm = null;
    // a cardinality on a CellDesigner map (create.js cardDown): the file keeps its number (stoichiometry), no place, so it
    // stays in the middle; a click on its box selects its line, a drag says why it stays, Delete then takes the number out
    // (an added reactant's or product's; a reaction's own two in Properties' Cardinality rows)
    cdCardDrag = null, cdCard = null;
    }
    function cdCardAt(e) {   // the line whose drawn cardinality (cdrender's count: 11 high, a grey edge) is under the pointer
      var hit = null;
      Array.prototype.forEach.call(V.img.querySelectorAll('[data-e] rect[height="11"]'), function (r) {
        if ((r.getAttribute('stroke') || '').toLowerCase() !== '#9aa0a6') return;
        var b = r.getBoundingClientRect();
        if (e.clientX >= b.left - 2 && e.clientX <= b.right + 2 && e.clientY >= b.top - 2 && e.clientY <= b.bottom + 2) hit = r.closest('[data-e]').getAttribute('data-e');
      });
      if (hit == null) return -1;
      var k = edges2.findIndex(function (q) { return q.id === hit; });
      return k >= 0 ? k : edges2.findIndex(function (q) { return q.id.indexOf(hit + '|') === 0; });   // a reaction's own: its main line, the whole reaction
    }
    function cdCardDown(e) {
      var k = cdCardAt(e);
      if (k < 0) return false;
      V.view.focus({ preventScroll: true });
      if (shared.selE.length === 1 && shared.selE[0] === k) { e.stopImmediatePropagation(); e.preventDefault(); cdCardDrag = { x: e.clientX, y: e.clientY }; return true; }
      cdCardDrag = { pick: k, x: e.clientX, y: e.clientY }; return true;   // a click selects its line, a drag moves the map
    }
    function __run22() {   // run at start, in order (__start)
    window.addEventListener('pointermove', function (e) {
      var d = cdCardDrag;
      if (!d) return;
      var far = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (d.pick != null) { if (!e.buttons || far >= 5) cdCardDrag = null; return; }
      if (far >= 4 && !d.said) { d.said = true; warn('CellDesigner keeps no place for a cardinality: it stays in the middle of its line.'); }
    }, true);
    window.addEventListener('pointerup', function (e) {
      var d = cdCardDrag; cdCardDrag = null;
      if (!d || d.pick == null) return;
      e.stopImmediatePropagation();
      shared.selN = []; shared.selP = []; shared.selE = [d.pick]; shared.part = null; cdCard = d.pick; paint();
    }, true);
    window.addEventListener('keydown', function (e) {   // Delete: its number out, not the line
      if (cdCard == null || (e.key !== 'Delete' && e.key !== 'Backspace') || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      var k = cdCard;
      if (!shared.cd || shared.selE.length !== 1 || shared.selE[0] !== k || shared.selN.length || shared.selP.length || !edges2[k]) { cdCard = null; return; }
      e.preventDefault(); e.stopImmediatePropagation();
      if (/\|[rp]\d+$/.test(edges2[k].id)) { cdCard = null; PF_CD.line.setCount(k, ''); }
      else warn('A reaction\'s own reactant and product: their numbers are cleared in Properties, Cardinality.');
    }, true);
    }
    function cdNameDown(e, P, h) {
      if (!cdPal() || tool || e.shiftKey || e.pointerType !== 'mouse' || edgeAt(P) || (h && (h.p != null || h.e != null || (h.n != null && !nodes2[h.n].comp)))) return false;   // a finger moves the map; a compartment's edge, a bend point, a line or a species over the name: theirs
      var k = -1, area = Infinity, info = null, pad = 3, res = null;   // the innermost compartment whose drawn name is under the pointer (one still named by its id too)
      nodes2.forEach(function (n, i) {
        var b = boxOf(i);
        if (!n.comp || b[2] * b[3] >= area || P[0] < b[0] || P[1] < b[1] || P[0] > b[0] + b[2] || P[1] > b[1] + b[3]) return;   // its name is inside its box
        if (textsOf(i, null, res = res || svIcons()).some(function (el) { var r = el.getBoundingClientRect(); return e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad; })) { k = i; area = b[2] * b[3]; }
      });
      if (k < 0 || shared.selN.indexOf(k) < 0) return false;   // the compartment selected first: a drag on the name of one not selected moves the map
      try { info = cdMk.nameInfo(cdNow().t, nodes2[k].id); } catch (err) { info = null; }
      if (!info) return false;
      e.stopImmediatePropagation(); e.preventDefault();
      V.view.setPointerCapture(e.pointerId); V.view.focus({ preventScroll: true });
      cdNm = { k: k, id: nodes2[k].id, info: info, P: P, x: e.clientX, y: e.clientY, p: null, parts: null, pid: e.pointerId };
      return true;
    }
    function __run23() {   // run at start, in order (__start)
    window.addEventListener('pointermove', function (e) {
      var d = cdNm;
      if (!d || e.pointerId !== d.pid) return;
      if (!e.buttons) { cdNameUp(); return; }   // released outside the window: no sticky hand
      if (!d.p && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
      var Q = at(e), I = d.info, want = [I.np[0] + Q[0] - d.P[0], I.np[1] + Q[1] - d.P[1]], best = null, bd = Infinity;
      window.cdrender.NAME_PLACES.forEach(function (p) { var q = window.cdrender.namePoint(I.box, I.name, I.th, p, I.oval), dd = Math.hypot(q[0] - want[0], q[1] - want[1]); if (dd < bd) { bd = dd; best = [p, q]; } });
      if (!d.parts) d.parts = textsOf(d.k, null);   // the name's own text, moved as it is (no copy)
      d.p = best[0];
      var dx = best[1][0] - I.np[0], dy = best[1][1] - I.np[1];
      d.parts.forEach(function (el) { if (dx || dy) el.setAttribute('transform', 'translate(' + f1(dx) + ' ' + f1(dy) + ')'); else el.removeAttribute('transform'); });
    }, true);
    window.addEventListener('pointerup', function (e) { if (cdNm && e.pointerId === cdNm.pid) cdNameUp(); }, true);
    window.addEventListener('pointercancel', function (e) { if (cdNm && e.pointerId === cdNm.pid) cdNameUp(true); }, true);
    }   // a drag taken away: nothing written
    function cdNameUp(cancel) {
      var d = cdNm; cdNm = null;
      if (!d) return;
      if (cancel) { (d.parts || []).forEach(function (el) { el.removeAttribute('transform'); }); return; }
      if (d.p && cdApply(function (t) { return cdMk.nameAt(t, d.id, d.p); }, [d.id])) return;
      (d.parts || []).forEach(function (el) { el.removeAttribute('transform'); });
      var k = nodes2.findIndex(function (n) { return n.id === d.id; });
      shared.selN = k >= 0 ? [k] : []; shared.selP = []; shared.selE = []; shared.part = null; paint();
    }
    // a name typed in place (a double click on a species, a complex's member included, on a complex's or a compartment's
    // drawn name, or anywhere on a complex or a compartment off what it holds; typeIn in create.js), written by cd_make.rename;
    // a degraded species has none
    function __run24() {   // run at start, in order (__start)
    V.view.addEventListener('dblclick', function (e) {
      if (!cdPal() || !editing(e)) return;
      if (tool || Date.now() - placedAt < 600) { e.stopImmediatePropagation(); return; }
      var named = function (n, k) { return cdRole(k) === 'epn' || n.comp || (n.up != null && nodes2[n.up].shape.kind === 'Complex'); };
      var P = at(e), sq = svAt(P);
      if (sq) { e.stopImmediatePropagation(); cdSvOpen(nodes2[sq[0]].id, sq[1]); return; }   // a residue's, the structural state's or the unit's window
      var i = nameAt(P, named);   // create.js: a species, a member, else a group's drawn name or the group round P; a line, a process or a gate nothing
      if (i < 0) return;
      var A = cdMk.aliasInfo(shared.cd.now, nodes2[i].id);
      if (A.cls === 'DEGRADED') return;
      e.stopImmediatePropagation(); typeIn(nodes2[i].id, null);
    }, true);
    }
    // the name as typed: CellDesigner's file keeps it escaped, a line break as _br_ and Greek letters spelled (cd_make.cdName);
    // a species not named yet carries its id (CellDesigner's way), shown as no name
    function cdNameOf(id, shown) {   // shown: the name as drawn (Properties), else '' for one still named after its id (typed in place)
      var A = cdMk.aliasInfo(shared.cd.now, id), s = A.name || '';
      if (s === A.id && !shown) return '';
      s = s.replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCodePoint(parseInt(h, 16)); }).replace(/&#(\d+);/g, function (m, d) { return String.fromCodePoint(+d); })
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      return window.cdrender.plainName(s).replace(/_br_/g, ' ');
    }
    function cdRename(id, v) { cdApply(function (t) { return cdMk.rename(t, id, v); }, [id]); }

    // state variables and units of information on a CellDesigner map, as on SBGN-ML maps (create.js svList, svAt, svDown):
    // a click selects one, a drag or the arrow keys move it round the border, Delete removes it. CellDesigner's three
    // kinds: a residue (a state variable: a site of a protein, its modification from CellDesigner's fixed list), the
    // structural state (one per species, an ellipse: open, closed or a free text) and the unit of information (one free
    // text per alias, at the top middle, not moved). Each is edited in a small window (cdSvWin) opened by a double click,
    // a click on one selected or Edit in its menu, never typed on the shape, so a modification or a unit's prefix and
    // label come only from CellDesigner's lists and the file always opens in CellDesigner. A residue belongs to the protein: its site and place are the protein's, on every species of it; its
    // modification is this species'. Once a variable, always a variable: before a residue changes, the protein's other
    // entries of the same name and type (a converted file's one per species) are joined into one (cd_make.joinKin). Written by cd_make (residue, residueState, residueName, residueMove, residueRemove,
    // structural, structuralMove, info), one undo step each
    var cdFeatMemo;
    function __run25() {   // run at start, in order (__start)
    cdFeatMemo = {};
    }   // per alias and file: cd_make.features (read by svAt on a press and svMarks while one is selected); of
    // cd.base, the file as written last (cd.now follows once drawn; a move of a node changes no feature)
    function cdFeat(id) {
      var t = shared.cd.base;
      if (cdFeatMemo.t !== t) cdFeatMemo = { t: t };
      if (!(id in cdFeatMemo)) { try { cdFeatMemo[id] = cdMk.features(t, id); } catch (e) { cdFeatMemo[id] = null; } }
      return cdFeatMemo[id];
    }
    function cdFront(i, f) { var b = boxOf(i), s = 6 * ((f && f.homodimer || 1) - 1); return [b[0], b[1], b[2] - s, b[3] - s]; }   // the front copy of a multimer (cdrender frontBox)
    // the icons shown on node i, as create.js svList gives them: [text, centre, size, kind, index among its kind]
    function cdSvList(i) {
      var n = nodes2[i];
      var role = n && cdRole(i);
      if (!n || n.comp || !cdMk || !window.cdrender || (role !== 'epn' && role !== null)) return [];
      var f = cdFeat(n.id);
      if (!f) return [];
      var b = cdFront(i, f), on = window.cdrender.onBorder, out = [];
      f.residues.forEach(function (r, k) { out.push([r.name, on(b, r.angle), [16, 16], SV, k]); });   // a residue's text: its site name (its modification in its window)
      var st = f.structural || (shared.cdPend && shared.cdPend.id === n.id && shared.cdPend.kind === SS ? { text: '', angle: shared.cdPend.angle } : null);
      if (st) out.push([st.text, on(b, st.angle), [2 * cdRx(st.text), 16], SS, 0]);
      if (f.info || (shared.cdPend && shared.cdPend.id === n.id && shared.cdPend.kind === UI)) out.push([f.info ? f.info.text : '', [b[0] + b[2] / 2, b[1]], [70, 16], UI, 0]);
      return out;
    }
    // Icons that never touch (notes/state-crowding.md; the SBGN-ML copy: create.js svRoom): a residue, the structural
    // state and the unit of information (or a multimer's count, drawn at the top) keep 2 px between their boxes. A new or
    // changed one takes the first free place of cd_make.placesFor, worked out from the species' size (the bottom from the
    // middle outwards, the sides' middles, the corners, the top, the sides' other places); with none free the species
    // grows about its centre (cdGrowStep), the residues on a grown side spread again (cdOn), and the places are worked out
    // again. Nothing else moves; never when a map is opened or saved.
    var cdTop;
    function __run27() {   // run at start, in order (__start)
    cdTop = Math.PI / 2;
    }
    function cdRx(txt) { return Math.trunc(window.cdrender.width(txt || '', 10) / 2 + 12); }   // a structural state's half width (cdrender)
    function cdFrontOf(t, a, box) { var I = cdMk.aliasInfo(t, a), b = box || I.box, s = 6 * ((I.homodimer || 1) - 1); return [b[0], b[1], b[2] - s, b[3] - s]; }   // cdFront from the file (box: a size tried)
    function cdAngleOn(p, F) { return cdMk.ratioAngle([(p[0] - F[0]) / F[2] - 0.5, (p[1] - F[1]) / F[3] - 0.5]); }
    // the icons on alias a of the file t, read once per action: { ang: its angle (null: the unit or count at the top), s:
    // size, k: kind, n: index among its kind }; cdOn puts them on a box
    function cdIcons0(t, a) {
      var f = cdMk.features(t, a), out = [];
      f.residues.forEach(function (r, k) { out.push({ ang: r.angle, s: [16, 16], k: SV, n: k }); });
      if (f.structural) out.push({ ang: f.structural.angle, s: [2 * cdRx(f.structural.text), 16], k: SS, n: 0 });
      if (f.info || cdMultiTop(t, a)) out.push({ ang: null, s: [70, 16], k: UI, n: 0 });
      return out;
    }
    // the icons put on front box F: drawn by their angles (as CellDesigner draws them on any box), or, the species grown
    // from F0 to F, the residues moved as create.js iconSpread moves them (spread again on a grown side), the structural
    // state kept at its distance from the middle of its side (iconKeep), the unit or count at the top; each with its centre c
    function cdOn(ic, F, F0) {
      var on = window.cdrender.onBorder, top = function (B) { return [B[0] + B[2] / 2, B[1]]; };
      if (!F0) return ic.map(function (q) { return { c: q.ang == null ? top(F) : on(F, q.ang), s: q.s, k: q.k, n: q.n }; });
      var rel = function (B, p) { return [p[0] - B[0] - B[2] / 2, p[1] - B[1] - B[3] / 2]; }, abs = function (p) { return [p[0] + F[0] + F[2] / 2, p[1] + F[1] + F[3] / 2]; };
      var rs = ic.filter(function (q) { return q.k === SV; }), os = ic.filter(function (q) { return q.k !== SV; });
      var oP = os.map(function (q) { return q.ang == null ? rel(F, top(F)) : iconKeep(rel(F0, on(F0, q.ang)), F0[2], F0[3], F[2], F[3]); });
      var rP = iconSpread(rs.map(function (q) { return { p: rel(F0, on(F0, q.ang)), s: q.s }; }), os.map(function (q, k) { return { p: oP[k], s: q.s }; }), F0[2], F0[3], F[2], F[3], 20);
      return ic.map(function (q) { var k = rs.indexOf(q); return { c: abs(k < 0 ? oP[os.indexOf(q)] : rP[k]), s: q.s, k: q.k, n: q.n }; });
    }
    function cdIcons(t, a, F) { return cdOn(cdIcons0(t, a), F || cdFrontOf(t, a)); }
    function cdClash(c, s, icons) {   // an icon s wide and high at c meets one of icons (2 px apart; 1e-6: a place built 2 px off a box stays free)
      return icons.some(function (q) { return Math.abs(c[0] - q.c[0]) < (s[0] + q.s[0]) / 2 + 2 - 1e-6 && Math.abs(c[1] - q.c[1]) < (s[1] + q.s[1]) / 2 + 2 - 1e-6; });
    }
    function cdPairs(ic) { var n = 0; ic.forEach(function (q, k) { ic.slice(k + 1).forEach(function (o) { if (cdClash(q.c, q.s, [o])) n++; }); }); return n; }   // icons that meet, counted in pairs
    // the next size tried, as create.js svGrowStep: 20 (a place's width) wider and higher in the kind's proportion
    // (CellDesigner's 80 by 40 for a protein: 100 by 50, 120 by 60, ...), about the centre. base: the kind's size
    function cdGrowStep(b, base) {
      var w = b[2] + 20, h = b[3] + 20 * base[1] / base[0];
      return [b[0] - (w - b[2]) / 2, b[1] - (h - b[3]) / 2, w, h];
    }
    function cdKindSize(t, a) { var I = cdMk.aliasInfo(t, a), L = cdMk.LOOK[I.cls]; return L ? [L[0], L[1]] : [I.box[2], I.box[3]]; }   // its proportion for cdGrowStep
    // a free place for an icon of size s on alias a: { box: the alias's box grown to make it (null: as it is), angle: on
    // that box }; first(F): angles tried before the order (the place kept, the top), skip(icon): icons not counted;
    // also(angle): true where the angle is taken elsewhere (a residue's place on the protein's other copies)
    function cdRoom(t, a, s, first, skip, also) {
      var b0 = cdMk.aliasInfo(t, a).box, b = b0, base = cdKindSize(t, a), on = window.cdrender.onBorder, F0 = cdFrontOf(t, a), F = F0;
      var ic0 = cdIcons0(t, a).filter(function (q) { return !skip || !skip(q); });
      for (var g = 0; g < 80; g++) {
        F = cdFrontOf(t, a, b);
        var ic = cdOn(ic0, F, F0), cands = (first ? first(F) : []).concat(cdMk.placesFor(F[2], F[3], Math.max(20, s[1] + 4)));
        for (var j = 0; j < cands.length; j++) if (!cdClash(on(F, cands[j]), s, ic) && !(also && also(cands[j]))) return { box: b === b0 ? null : b, angle: cands[j] };
        b = cdGrowStep(b, base);
      }
      return { box: b === b0 ? null : b, angle: cdMk.placesFor(F[2], F[3])[0] };
    }
    var cdGrew;
    function __run28() {   // run at start, in order (__start)
    cdGrew = null;
    }   // during cdApply: alias id -> its box before it grew (in the editor's frame), its holders grown after
    function cdGrowBounds(t, a, box) {   // the bounds alone (the icons kept by angle, in proportion: another copy of the protein)
      if (cdGrew && !cdGrew[a]) { var i = nodes2.findIndex(function (n) { return n.id === a; }); if (i >= 0) cdGrew[a] = boxOf(i); }
      return cdMk.bounds(t, a, box);
    }
    // alias a grown to box, its residues and structural state moved as cdOn moves them (their angles written again);
    // the residues' new angles are the protein's, so the other copies are given room after (cdFitOthers)
    function cdGrow(t, a, box, skip) {   // skip(icon): left out, as cdRoom left it out (it moves next)
      if (!box) return t;
      var t0 = t, F0 = cdFrontOf(t, a), F = cdFrontOf(t, a, box), ic = cdOn(cdIcons0(t, a).filter(function (q) { return !skip || !skip(q); }), F, F0), any = false;
      ic.forEach(function (q) {
        if (q.k === SV) { t = cdMk.residueMove(t, a, q.n, cdAngleOn(q.c, F)); any = true; }
        else if (q.k === SS) t = cdMk.structuralMove(t, a, cdAngleOn(q.c, F));
      });
      t = cdGrowBounds(t, a, box);
      return any ? cdFitOthers(t0, t, a) : t;
    }
    // the protein's other copies (every species naming it shows its residues, at the same angles) after id's residues
    // changed from t0 to t: a copy where more icons meet than before grows (its bounds; the icons by angle) until no more
    // meet than before; where growing does not part them (icons at one place), it is left as it is. Overlaps a file
    // already had stay
    function cdFitOthers(t0, t, id) {
      cdMk.proteinAliases(t, id).forEach(function (a) {
        if (a === id) return;
        var was = cdPairs(cdIcons(t0, a)), ic = cdIcons0(t, a), b0 = cdMk.aliasInfo(t, a).box, b = b0, base = cdKindSize(t, a);
        if (cdPairs(cdOn(ic, cdFrontOf(t, a))) <= was) return;
        for (var g = 0; g < 30; g++) {
          b = cdGrowStep(b, base);
          if (cdPairs(cdOn(ic, cdFrontOf(t, a, b))) <= was) { t = cdGrowBounds(t, a, b); return; }
        }
      });
      return t;
    }
    // a residue's place taken on the protein's other copies: there it would meet their unit of information, count or
    // structural state (residues there part by growing, cdFitOthers; those at the top do not)
    function cdOthersTop(t, id) {
      var on = window.cdrender.onBorder, cs = cdMk.proteinAliases(t, id).filter(function (a) { return a !== id; }).map(function (a) { var F = cdFrontOf(t, a); return [F, cdIcons(t, a, F).filter(function (q) { return q.k !== SV; })]; });
      return function (ang) { return cs.some(function (c) { return cdClash(on(c[0], ang), [16, 16], c[1]); }); };
    }
    // a new residue on alias id at its first free place (the alias grown where none is), then room for it on the other
    // aliases of the protein: { text, residue: its index }
    function cdResidueNew(t, id) {
      t = cdMk.joinKin(t, id);   // the protein's other entries of its name joined first (cd_make.joinKin)
      var r = cdRoom(t, id, [16, 16], null, null, cdOthersTop(t, id));
      t = cdGrow(t, id, r.box);
      var o = cdMk.residue(t, id, { state: 'empty', angle: r.angle });
      return { text: cdFitOthers(t, o.text, id), residue: o.residue };
    }
    // a residue k moved off what it meets on alias id (a unit of information come to the top): the first free place, the
    // others' room after it
    function cdResidueRoom(t, id, k) {
      var sk = function (q) { return q.k === SV && q.n === k; }, r = cdRoom(t, id, [16, 16], null, sk, cdOthersTop(t, id));
      t = cdGrow(t, id, r.box, sk);
      return cdFitOthers(t, cdMk.residueMove(t, id, k, r.angle), id);
    }
    // a structural state's places tried first: the angle kept (keep), else the top middle and, with a unit of information
    // (or a count) at the top, beside it, right then left, when both fit on the top side
    function cdSsFirst(txt, keep) {
      return function (F) {
        if (keep != null) return [keep];
        var rx = cdRx(txt), H = Math.PI / 2, c = [cdTop];
        [37 + rx, -(37 + rx)].forEach(function (dx) { if (Math.abs(dx) + rx <= F[2] / 2) c.push(H - dx / F[2] * H); });
        return c;
      };
    }
    function cdSsAngle(t, id, txt) { return cdRoom(t, id, [2 * cdRx(txt), 16], cdSsFirst(txt), function (q) { return q.k === SS; }).angle; }   // where it would go now, the alias as it is (a new one shown before it is typed)
    // the structural state with text v on every copy of the species: each where it was while the text still fits there
    // (keep: id's own angle, a new one's place shown), else its first free place, the copy grown where none is
    function cdSsSet(t, id, v, keep) {
      var was = {};
      cdCopiesOf(t, id).forEach(function (a) { var s = cdMk.features(t, a).structural; was[a] = a === id && keep != null ? keep : s ? s.angle : null; });
      t = cdMk.structural(t, id, v, true);
      Object.keys(was).forEach(function (a) {
        var s = [2 * cdRx(v), 16], skip = function (q) { return q.k === SS; }, r = null;
        if (was[a] != null) r = cdRoom(t, a, s, function () { return [was[a]]; }, skip);
        if (!r || r.box || r.angle !== was[a]) r = cdRoom(t, a, s, cdSsFirst(v), skip);   // not where it was: the top first, as a new one
        t = cdMk.structuralMove(cdGrow(t, a, r.box, skip), a, r.angle);
      });
      return t;
    }
    var cdMultiMemo;
    function __run29() {   // run at start, in order (__start)
    cdMultiMemo = [null, null];
    }   // [file, { class and name: true }]: the multimers on the map, read in one pass per file
    function cdKindKey(sp) { var cl = /<celldesigner:class>([^<]*)</.exec(sp), nm = / name="([^"]*)"/.exec(sp); return cl && nm ? cl[1] + '\u0001' + nm[1] : null; }
    function cdMultis(t) {
      if (cdMultiMemo[0] !== t) {
        var out = {}, re = /<species [^>]*>[\s\S]*?<\/species>/g, m;
        while ((m = re.exec(t))) { var hd = /<celldesigner:homodimer>(\d+)</.exec(m[0]), key = hd && +hd[1] > 1 && cdKindKey(m[0]); if (key) out[key] = true; }
        cdMultiMemo = [t, out];
      }
      return cdMultiMemo[1];
    }
    function cdMultiTop(t, id) {   // the species' kind drawn as a multimer somewhere on the map (its count at the top)
      var sp = new RegExp('<species [^>]*id="' + cdMk.aliasInfo(t, id).id + '"[^>]*>[\\s\\S]*?</species>').exec(t), key = sp && cdKindKey(sp[0]);
      return !!(key && cdMultis(t)[key]);
    }
    // the copies (aliases) of node id's species in the file t, id first
    function cdCopiesOf(t, id) {
      var sid = cdMk.aliasInfo(t, id).id, out = [id], re = new RegExp('<celldesigner:(?:complexS|s)peciesAlias id="([^"]*)" species="' + sid + '"', 'g'), m;
      while ((m = re.exec(t))) if (m[1] !== id) out.push(m[1]);
      return out;
    }
    // every alias of a species of id's class and name (cdMultiTop draws a multimer's count on each)
    function cdKindAliases(t, id) {
      var sp = new RegExp('<species [^>]*id="' + cdMk.aliasInfo(t, id).id + '"[^>]*>[\\s\\S]*?</species>').exec(t), key = sp && cdKindKey(sp[0]), out = [];
      if (!key) return cdCopiesOf(t, id);
      var re = /<species [^>]*>[\s\S]*?<\/species>/g, m;
      while ((m = re.exec(t))) if (cdKindKey(m[0]) === key) { var sid = / id="([^"]*)"/.exec(m[0]); if (sid) cdCopiesOf(t, cdFirstAlias(t, sid[1]) || id).forEach(function (a) { if (out.indexOf(a) < 0) out.push(a); }); }
      return out.length ? out : [id];
    }
    function cdFirstAlias(t, sid) { var m = new RegExp('<celldesigner:(?:complexS|s)peciesAlias id="([^"]*)" species="' + sid + '"').exec(t); return m ? m[1] : null; }
    // the top made free for a unit of information (on that copy) or a multimer's count (on every species of its kind): a
    // structural state or a residue on a copy that the unit's box now meets moved to its first free place (the copy grown
    // where none is); one clear of it stays
    function cdTopClear(t, id, all) {
      (all ? cdKindAliases(t, id) : [id]).forEach(function (a) {
        for (var g = 0; g < 40; g++) {
          var ic = cdIcons(t, a), u = ic.filter(function (q) { return q.k === UI; });
          var hit = ic.filter(function (q) { return q.k !== UI && cdClash(q.c, q.s, u); })[0];
          if (!hit) break;
          if (hit.k === SS) { var s = cdMk.features(t, a).structural, r = cdRoom(t, a, hit.s, cdSsFirst(s.text), function (q) { return q.k === SS; }); t = cdMk.structuralMove(cdGrow(t, a, r.box, function (q) { return q.k === SS; }), a, r.angle); }
          else t = cdResidueRoom(t, a, hit.n);
        }
      });
      return t;
    }
    // the angle of a place on node i's border ([rx, ry] of its front copy, create.js border and svBox), as CellDesigner
    // keeps it: onBorder's inverse, 0 the right, pi/2 the top
    function cdAngle(i, r) { return cdMk.ratioAngle(r); }   // cd_make's (onBorder's inverse), one copy
    function cdSvMove(i, j, r) {   // the icon j of node i moved to the place r: its angle written (a unit of information stays)
      var q = cdSvList(i)[j], id = nodes2[i].id;
      if (!q || q[3] === UI) return false;
      var a = cdAngle(i, r), ok = cdApply(function (t) { return q[3] === SV ? cdMk.residueMove(cdMk.joinKin(t, id), id, q[4], a) : cdMk.structuralMove(t, id, a); }, []);
      shared.svSel = { id: id, j: j }; paint();
      return ok;
    }
    function cdSvDelete(i, j) {
      var q = cdSvList(i)[j], id = nodes2[i].id;
      if (!q) return false;
      return cdApply(function (t) { return q[3] === SV ? cdMk.residueRemove(cdMk.joinKin(t, id), id, q[4]) : q[3] === SS ? cdMk.structural(t, id, null) : cdMk.info(t, id, null); }, [id]);
    }
    // a double click, a click on one selected or Edit in its menu: the window of a residue, the structural state or the
    // unit of information
    function cdSvOpen(id, j) {
      var i = nodes2.findIndex(function (n) { return n.id === id; }), q = i < 0 ? null : cdSvList(i)[j];
      if (!q) return;
      cdSvWin(id, q[3], q[4]);
    }
    // a new structural state's text typed in its ellipse (typeIn, create.js): written on every copy of the species, each
    // at its own free place (this one where it was shown); nothing when left empty
    function cdSsTyped(id, v) {
      var pend = shared.cdPend && shared.cdPend.id === id && shared.cdPend.kind === SS ? shared.cdPend : null;
      shared.cdPend = null;
      if (pend && v) cdApply(function (t) { return cdSsSet(t, id, v, pend.angle); }, []);
      paint();
    }
    // the window of a residue (Site, then Modification, the order of CellDesigner's Change identity: its residues, then
    // their modification), of the structural state (State: open, closed or a text; then the text) or of the unit of
    // information (CellDesigner's Edit Information: Prefix pc, mt, ct, N or free input, then Label, a list for pc, mt and
    // ct, a text for N and free input; a new one shows CellDesigner's first, pc and T): beside it over the
    // map, the right-click menu's look, quiet: no note, no example, no field focused on opening (the window itself takes
    // the keys). A choice is written at once, a text when Enter is pressed or the field is left, each one undo step. Below
    // the node where there is room, else above, right, left. Enter, Esc or a click outside close it. Kept as typing
    // (create.js), so a zoom or a pan moves it and another map, leaving editing or another field closes it (its text kept)
    function cdSvWin(id, kind, k) {
      if (shared.typing) shared.typing.done(true);
      var m0 = map, res = kind === SV, ui = kind === UI;
      var feat = function () { try { return cdMk.features(shared.cd.base, id); } catch (e) { return null; } };   // the file as just written (cd.now follows once drawn)
      var f = feat();
      if (!f || (res && !f.residues[k])) return;
      var box = document.createElement('div');
      box.className = 'm2-cx m2-cdsv'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', res ? 'Residue' : ui ? 'Unit of information' : 'Structural state');
      box.innerHTML = ui
        ? '<label><span>Prefix</span><select></select></label><label class="m2-cdsv-list"><span>Label</span><select></select></label>'
          + '<label class="m2-cdsv-text"><span>Label</span><input type="text" spellcheck="false"></label><button type="button">Remove</button>'
        : res
        ? '<label><span>Site</span><input type="text" spellcheck="false"></label><label><span>Modification</span><select></select></label>'
        : '<label><span>State</span><select><option value="open">Open</option><option value="closed">Closed</option><option value="">Text</option></select></label>'
          + '<label class="m2-cdsv-text"><span>Text</span><input type="text" spellcheck="false"></label><button type="button">Remove</button>';
      var inp = box.querySelector('input'), sel = box.querySelector('select'), row = box.querySelector('.m2-cdsv-text');
      var lrow = box.querySelector('.m2-cdsv-list'), lab = lrow && lrow.querySelector('select');
      var fixed = function () { return !!cdMk.INFO[sel.value]; };   // a unit's prefix with a list of labels (pc, mt, ct)
      var labels = function () {   // a unit's Label row for its prefix: the list, else the text field
        lab.textContent = '';
        (cdMk.INFO[sel.value] || []).forEach(function (l) { lab.appendChild(new Option(l, l)); });
        lrow.hidden = !fixed(); row.hidden = fixed();
      };
      if (res) cdMk.STATES.forEach(function (s) { sel.appendChild(new Option(s, s)); });   // CellDesigner's names as its list writes them
      var rid = res ? f.residues[k].id : null;   // the residue by its id: another one removed or an undo moves its index
      var pendOf = function () { return shared.cdPend && shared.cdPend.id === id && shared.cdPend.kind === kind ? shared.cdPend : null; };
      if (ui) {
        Object.keys(cdMk.INFO).concat(['N', 'free input']).forEach(function (p) { sel.appendChild(new Option(p, p)); });
        sel.value = f.info ? f.info.prefix : 'pc'; labels();
        if (fixed()) lab.value = f.info ? f.info.label : lab.options[0].value; else inp.value = f.info ? f.info.label : '';
      }
      else if (res) { inp.value = f.residues[k].name || ''; sel.value = f.residues[k].state || 'empty'; }
      else {
        var now = f.structural ? f.structural.text : '';
        sel.value = /^(open|closed)$/.test(now) ? now : '';
        inp.value = sel.value ? '' : now;
        row.hidden = !!sel.value;
      }
      var T;
      var live = function () { return shared.typing === T && on && map === m0; };
      var kNow = function () { var g = feat(); return g ? g.residues.findIndex(function (r) { return r.id === rid; }) : -1; };
      var jOf = function () {   // its index among the node's icons (cdSvList: the residues, then the structural state); -1 when gone
        var g = feat();
        return !g ? -1 : res ? kNow() : ui ? (g.info || pendOf() ? g.residues.length + (g.structural ? 1 : 0) : -1) : g.structural || pendOf() ? g.residues.length : -1;
      };
      var write = function (fn) {
        if (!live()) return;
        if (res && (k = kNow()) < 0) { T.done(false); return; }   // removed meanwhile: nothing written
        cdApply(fn, []);
        var j = jOf();
        if (j < 0 && !pendOf()) { T.done(false); return; }   // gone (removed): the window with it
        shared.svSel = j < 0 ? null : { id: id, j: j }; paint();
      };
      var site = function () {   // the site as typed, when it differs
        var kk = kNow(), r = kk < 0 ? null : feat().residues[kk], v = inp.value.trim();
        if (r && v !== (r.name || '')) write(function (t) { return cdMk.residueName(cdMk.joinKin(t, id), id, k, v); });
      };
      var put = function (v) {   // the structural state's text written (a new one on every copy, each at its own free place), or none
        var pend = pendOf();
        if (v) {
          write(function (t) { return cdSsSet(t, id, v, pend ? pend.angle : null); });
          if (pend && shared.cdPend === pend) shared.cdPend = null;
        }
        else if (!pend) write(function (t) { return cdMk.structural(t, id, null); });
      };
      var unit = function (q) {   // the unit written as chosen ([prefix, label]; null: none), the top made free for it
        var pend = pendOf();
        if (!q) { if (!pend) write(function (t) { return cdMk.info(t, id, null); }); return; }
        write(function (t) { return cdTopClear(cdMk.info(t, id, q, true), id, false); });
        if (pend && shared.cdPend === pend) shared.cdPend = null;
      };
      var chosen = function () { return [sel.value, fixed() ? lab.value : inp.value.trim()]; };
      var typed = function () {
        if (ui) {   // a typed label (N, free input) when it differs; a new unit as shown, pc and T unless changed
          var g = (feat() || {}).info, q = chosen();
          if (q[1] && (pendOf() || !g || g.prefix !== q[0] || g.label !== q[1])) unit(q);
          return;
        }
        if (res) site(); else if (!sel.value) { var v = inp.value.trim(), st = (feat() || {}).structural; if (v !== (st ? st.text : '') || (v && pendOf())) put(v); } };
      var place = function () {
        var i = nodes2.findIndex(function (n) { return n.id === id; }), j = jOf(), q = i < 0 || j < 0 ? null : cdSvList(i)[j];
        if (i < 0 || !box.isConnected) return;
        if (!q || q[3] !== kind) { var b = boxOf(i); q = [0, [b[0] + b[2] / 2, b[1] + b[3] / 2], [b[2], 0]]; }   // not drawn yet: beside its node
        var vr = V.view.getBoundingClientRect(), z = box.getBoundingClientRect().width / box.offsetWidth || 1, w = box.offsetWidth * z, ht = box.offsetHeight * z;
        // the node with its icon, never covered: below it where the window has room, else above, else right, else left
        var nb = boxOf(i), X0 = Math.min(nb[0], q[1][0] - q[2][0] / 2), X1 = Math.max(nb[0] + nb[2], q[1][0] + q[2][0] / 2), Y0 = Math.min(nb[1], q[1][1] - q[2][1] / 2), Y1 = Math.max(nb[1] + nb[3], q[1][1] + q[2][1] / 2);
        var L = vr.left + sx(X0) * z, R = vr.left + sx(X1) * z, T0 = vr.top + sy(Y0) * z, B = vr.top + sy(Y1) * z, g = 10 * z, W = V.winW(), H = V.winH();
        var cx = Math.max(4, Math.min((L + R) / 2 - w / 2, W - 4 - w)), cy = Math.max(4, Math.min((T0 + B) / 2 - ht / 2, H - 4 - ht));
        var at = B + g + ht <= H - 4 ? [cx, B + g] : T0 - g - ht >= 4 ? [cx, T0 - g - ht] : R + g + w <= W - 4 ? [R + g, cy] : L - g - w >= 4 ? [L - g - w, cy] : [cx, Math.max(4, H - 4 - ht)];
        box.style.left = at[0] / z + 'px'; box.style.top = at[1] / z + 'px';
      };
      var outside = function (e) { if (!box.contains(e.target)) T.done(true); };
      T = shared.typing = { inp: inp, place: place, done: function (keep) {
        if (shared.typing !== T) return;
        if (keep) typed();
        shared.typing = null; box.remove(); document.removeEventListener('pointerdown', outside, true);
        if (pendOf()) shared.cdPend = null;
        paint();
      } };
      sel.addEventListener('change', function () {
        if (ui) {   // a prefix with a list: its first label written at once; N or free input: the label typed, written on Enter
          var g = (feat() || {}).info, typed = inp.value.trim(), was = typed || (g && !cdMk.INFO[g.prefix] ? g.label : '');
          labels();
          if (g && g.prefix === sel.value) { if (fixed()) lab.value = g.label; else inp.value = g.label; return; }   // back to its own prefix: as it is, nothing written
          if (fixed()) unit(chosen()); else { inp.value = was; inp.focus(); if (was) unit(chosen()); }
          return;
        }
        if (res) { var s = sel.value; write(function (t) { return cdMk.residueState(cdMk.joinKin(t, id), id, k, s); }); return; }
        row.hidden = !!sel.value;
        if (sel.value) put(sel.value); else { var g = feat(); inp.value = g && g.structural ? g.structural.text : ''; inp.focus(); }   // Text: from what is there, written once changed
      });
      inp.addEventListener('change', typed);
      if (ui) lab.addEventListener('change', function () { unit(chosen()); });
      if (!res) box.querySelector('button').addEventListener('click', function () { if (pendOf()) T.done(false); else if (ui) unit(null); else put(null); });
      box.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); T.done(false); V.view.focus({ preventScroll: true }); }
        else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); T.done(true); V.view.focus({ preventScroll: true }); }
      });
      box.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      box.addEventListener('keydown', function (e) {   // Tab and Shift+Tab go round the window's own fields, so no key reaches the map under it
        if (e.key !== 'Tab') return;
        var fs = Array.prototype.filter.call(box.querySelectorAll('input, select, button'), function (x) { return !x.closest('[hidden]'); }), at = fs.indexOf(document.activeElement);
        e.preventDefault(); fs[(at + (e.shiftKey ? -1 : 1) + fs.length) % fs.length].focus();
      });
      document.body.appendChild(box);
      document.addEventListener('pointerdown', outside, true);
      var j0 = jOf();
      shared.svSel = j0 < 0 ? null : { id: id, j: j0 }; paint(); place();
      box.tabIndex = -1; setTimeout(function () { if (shared.typing === T) box.focus({ preventScroll: true }); }, 0);
    }
    // added from the species' menu: a residue as an empty circle at the first free place (cdResidueNew), selected (its window
    // by a double click); a structural state (never empty) typed at once in its ellipse at cdSsAngle; a unit of
    // information at the top middle with its window (written once chosen)
    function cdSvAdd(id, kind) {
      var i = nodes2.findIndex(function (n) { return n.id === id; });
      if (i < 0) return;
      if (shared.typing) shared.typing.done(true);   // a field still open written first, so it does not take this one's place
      if (kind === SV) {
        var k = null;
        if (!cdApply(function (t) { var o = cdResidueNew(t, id); k = o.residue; return o.text; }, [])) return;
        shared.svSel = { id: id, j: k }; paint();
        return;
      }
      shared.cdPend = kind === SS ? { id: id, kind: SS, angle: cdSsAngle(shared.cd.base, id, '') } : { id: id, kind: UI };
      if (kind === UI) { cdSvWin(id, UI, 0); return; }
      var j = cdSvList(i).map(function (q) { return q[3]; }).indexOf(SS);
      if (j < 0) { shared.cdPend = null; return; }
      typeIn(id, j);
    }
    // the right-click items over a species or a complex: Add state variable (a protein's residue), Add structural state,
    // Add unit of information, each while the species can take one more
    function cdSvItems(id, A) {
      var f = cdFeat(id), out = [];
      if (!f || A.cls === 'DEGRADED') return out;
      if (f.protein) out.push(['Add state variable', function () { cdSvAdd(id, SV); }]);
      if (!f.structural) out.push(['Add structural state', function () { cdSvAdd(id, SS); }]);
      if (!f.info) out.push(['Add unit of information', function () { cdSvAdd(id, UI); }]);
      return out;
    }
    // the right-click menu over a residue (Edit: its window; Change state: its modification from CellDesigner's list, as
    // Change identity's window), the structural state (Edit) or the unit of information (Edit; Change unit: CellDesigner's
    // prefixes with their labels, N and free input in its window); then the viewer's Delete
    function cdSvOwnItems(q) {
      var i = q[0], it = cdSvList(i)[q[1]], id = nodes2[i].id;
      if (!it) return null;
      var out = [['Edit', function () { cdSvOpen(id, q[1]); }]];
      if (it[3] === UI) return out.concat(cdUnitItems(id, q[1]));
      if (it[3] !== SV) return out;
      var now = cdFeat(id).residues[it[4]].state || 'empty';
      out.push(['Change state', subItem(function (r, done) {
        return kindWindow(r, cdMk.STATES.map(function (s) {
          return { name: s, own: s === now,
            go: function () { cdApply(function (t) { return cdMk.residueState(cdMk.joinKin(t, id), id, it[4], s); }, []); shared.svSel = { id: id, j: q[1] }; paint(); } };
        }), done);
      })]);
      return out;
    }
    function cdUnitItems(id, j) {
      var f = cdFeat(id), now = f && f.info ? f.info.prefix + ':' + f.info.label : '', list = [];   // as the file holds it: free input mt:prot is not mt's prot
      Object.keys(cdMk.INFO).forEach(function (p) { cdMk.INFO[p].forEach(function (l) { list.push([p, l]); }); });
      return [['Change unit', subItem(function (r, done) {
        return kindWindow(r, list.map(function (u) {
          return { name: u.join(':'), own: u.join(':') === now, go: function () { cdApply(function (t) { return cdMk.info(t, id, u, true); }, []); shared.svSel = { id: id, j: j }; paint(); } };
        }), done);
      })]];
    }

    // resizing and Properties on a CellDesigner map (propFmt, create.js): a species resized by its handles or by Width and
    // Height, as on SBGN-ML maps (a complex's member too, the complex growing round it; a complex with members as a holder: roomy, core.js); the label, the fill, the
    // border width and multimer (the species' homodimer, 2 when ticked) written by cd_make. No border colour (CellDesigner's
    // species have none); a degraded species keeps its look and its id as its name. A complex (a member one too) and a
    // compartment have Properties too: Width, Height and Fill (a compartment's colour, its band and lines drawn from it), a
    // complex its border width; Set as default (cdDef) for species only
    function cdSpecies(i) { return cdRole(i) === 'epn' && nodes2[i].el.getAttribute('yfiles.foldertype') !== 'group'; }
    function cdSetSize(pairs) {   // each node given its box, one undo step with the compartments round them grown to hold them (written back by cd_edit)
      var ids = [], was = {}, one = {};
      pairs.forEach(function (q) { var b = boxOf(q[0]); if (q[1].some(function (v, j) { return Math.abs(v - b[j]) >= 0.005; })) { ids.push(nodes2[q[0]].id); was[nodes2[q[0]].id] = b; one[q[0]] = q[1]; } });
      if (!ids.length) { liveOff(); sizeOff(); paint(); return; }
      commit(null, { name: 'size', ids: ids, write: function () { setBoxes(one); }, parsed: true, then: function () {
        var ks = nodes2.map(function (n, k) { return ids.indexOf(n.id) >= 0 ? k : -1; }).filter(function (k) { return k >= 0; });
        setBoxes(grown(ks, boxOf, function (k) { return was[nodes2[k].id] || boxOf(k); }, function () { return false; }));
        shared.selN = []; nodes2.forEach(function (n, k) { if (ids.indexOf(n.id) >= 0) shared.selN.push(k); });
        shared.sizeRec = null;
      } });
    }
    var cdLook, cdLineMemo;
    function __run30() {   // run at start, in order (__start)
    cdLook = [], cdLineMemo = [null, null, null, null];
    }   // [alias id, file, its look]; [line id, file, its colour, its width]
    function cdLineRead(k) {   // read once per line and file (it runs with every paint)
      var id = edges2[k].id;
      if (cdLineMemo[0] !== id || cdLineMemo[1] !== shared.cd.now) { var c = null, w = null; try { c = cdMk.lineColour(shared.cd.now, id); w = cdMk.lineWidth(shared.cd.now, id); } catch (e) { c = w = null; } cdLineMemo = [id, shared.cd.now, c, w]; }
      return cdLineMemo;
    }
    function cdLineColour(k) { return cdLineRead(k)[2]; }
    var cdPartsMemo;
    function __run31() {   // run at start, in order (__start)
    cdPartsMemo = [null, null, null];
    }   // [reaction, file, its participants]: read once per reaction and file
    function cdParts(rid) {
      if (cdPartsMemo[0] !== rid || cdPartsMemo[1] !== shared.cd.now) { var p; try { p = cdMk.participants(shared.cd.now, rid); } catch (e) { p = []; } cdPartsMemo = [rid, shared.cd.now, p]; }
      return cdPartsMemo[2];
    }
    var cdCountMemo;
    function __run32() {   // run at start, in order (__start)
    cdCountMemo = {};
    }   // a line's cardinality by its id, for one file (Properties runs with every paint)
    function cdCount(id) {
      if (cdCountMemo.now !== shared.cd.now) cdCountMemo = { now: shared.cd.now };
      if (!(id in cdCountMemo)) { var c; try { c = cdMk.stoichiometry(shared.cd.now, id); } catch (e) { c = undefined; } cdCountMemo[id] = c; }
      return cdCountMemo[id];
    }
    function cdMember(i) { var n = nodes2[i]; return n.up != null && nodes2[n.up].shape.kind === 'Complex'; }   // a complex's member (a complex inside one too)
    function cdProp(i) { return cdSpecies(i) || cdMember(i) || nodes2[i].comp || (cdRole(i) === 'epn' && nodes2[i].shape.kind === 'Complex'); }   // what Properties and resizing are for: a species, a member (its complex growing round it), a complex, a compartment
    function cdLineTo(k, f) {   // the line, or its whole reaction, changed by f and selected again
      var id = edges2[k].id, keep = /\|[mrp]\d+$/.test(id) ? id : id.replace(/\|[^|]*$/, '');
      return cdApply(function (t) { return f(t, id); }, [], [keep]);
    }
    var PF_CD;
    function __run33() {   // run at start, in order (__start)
    PF_CD = { sizable: cdProp, size: cdSetSize, def: cdDef,
      rx: { of: cdRxOf, set: cdReversible,   // a reaction's Reversible (propRx, create.js)
        counts: cdParts,   // its reactants' and products' numbers by name (rxCounts)
        setCount: function (rid, line, v) { return cdApply(function (t) { return cdMk.restoich(t, line, v); }, [], [rid]); } },
      // a line's colour and width (edgeShow, edgeSet): a modifier's, an added reactant's or product's own, else its
      // reaction's (a reduced notation's line, a main line); a gate's lines none (cd_make.lineColour null), no ports as offsets
      line: { colour: cdLineColour, set: function (k, c) { return cdLineTo(k, function (t, id) { return cdMk.recolourLine(t, id, c || '#000000'); }); },
        width: function (k) { return cdLineRead(k)[3]; }, setWidth: function (k, w) { return cdLineTo(k, function (t, id) { return cdMk.rewidthLine(t, id, w); }); }, ports: false,
        count: function (k) { return /\|[rp]\d+$/.test(edges2[k].id) ? cdCount(edges2[k].id) : undefined; },   // an added reactant's or product's own number (the main ones are the reaction's rows)
        setCount: function (k, v) { return cdLineTo(k, function (t, id) { return cdMk.restoich(t, id, v); }); } },
      node: function (i) { return cdProp(i) ? i : -1; },
      off: function (k, i) {   // pNow: look's, read just before; a compartment no border width, multimer or font size (CellDesigner keeps none for its name), a complex no multimer, an Unknown no border width
        return k === 'line' || k === 'ant' || (k === 'ss' && /^(COMPARTMENT|DEGRADED)$/.test(pNow.cls)) || (/^(mem|outer|inner)$/.test(k) && pNow.cls !== 'COMPARTMENT') || (/^(label|font|fill|multimer)$/.test(k) && pNow.cls === 'DEGRADED') || (/^(width|multimer|def|font)$/.test(k) && pNow.cls === 'COMPARTMENT') || (/^(multimer|def)$/.test(k) && pNow.cls === 'COMPLEX') || (k === 'width' && pNow.cls === 'UNKNOWN');   // an Unknown has no outline in CellDesigner, so no border width
      },
      look: function (i) {   // null while the file is behind the map read (an undo not drawn yet); read once per node and file (it runs with every paint)
        var id = nodes2[i].id;
        if (cdLook[0] !== id || cdLook[1] !== shared.cd.now) {
          var L = null;
          try { L = cdMk.look(shared.cd.now, id); var ss = cdMk.features(shared.cd.now, id).structural; L = { ss: ss ? ss.text : '', label: cdNameOf(id, true), font: L.font, fill: L.fill, line: '#000000', width: L.width, multimer: L.multimer, cls: L.cls, mem: L.mem, outer: L.outer, inner: L.inner }; } catch (e) { L = null; }
          cdLook = [id, shared.cd.now, L];
        }
        return cdLook[2] && Object.assign({}, cdLook[2]);
      },
      set: function (k, v, is) {   // every node of is given the value, one undo step
        var ids = is.map(function (i) { return nodes2[i].id; }), all = function (f) { return cdApply(function (t) { ids.forEach(function (id) { t = f(t, id); }); return t; }, ids); };
        if (k === 'label') return all(function (t, id) { return cdMk.rename(t, id, v.replace(/[\r\n]+/g, ' ')); });
        if (k === 'multimer') return all(function (t, id) { return !v ? cdMk.homodimer(t, id, 1) : cdMk.aliasInfo(t, id).homodimer > 1 ? t : cdTopClear(cdMk.homodimer(t, id, 2), id, true); });   // a count above 2 kept; the top made free for N:2
        if (k === 'width') { var x = parseFloat(v); return isFinite(x) && all(function (t, id) { return cdMk.restyle(t, id, { width: Math.min(Math.max(x, 0.25), 20) }); }); }   // outside 0.25 to 20: the nearest, silently
        if (k === 'font') { var z = parseFloat(v); return isFinite(z) && all(function (t, id) { return cdMk.restyle(t, id, { font: Math.min(Math.max(Math.round(z), 1), 200) }); }); }   // whole numbers (CellDesigner's), 1 to 200: the nearest, silently
        if (k === 'fill') { var c = hex(v); return !!c && all(function (t, id) { return cdMk.restyle(t, id, { fill: c }); }); }
        if (/^(mem|outer|inner)$/.test(k)) return cdDouble(k, parseFloat(v), ids);
        if (k === 'ss') {   // the structural state's text (notes/cd-residues.md, point 4): written on every copy, each at its place while it fits (cdSsSet); emptied, removed
          var tx = v.replace(/[\r\n]+/g, ' ').trim();
          return all(function (t, id) { if (/^(COMPARTMENT|DEGRADED)$/.test(cdMk.aliasInfo(t, id).cls || 'COMPARTMENT')) return t; var s0 = cdMk.features(t, id).structural; return tx ? (s0 && s0.text === tx ? t : cdSsSet(t, id, tx, null)) : s0 ? cdMk.structural(t, id, null) : t; });
        }
        return false;
      } };
    // a compartment's double line in Properties: Membrane (its thickness), Outer line and Inner line (their widths), after
    // Border width. A number outside the limits is set, without a word, to the nearest allowed (as a graph editor's
    // fields): CellDesigner's (thickness 2 at least, inner line 1 at least, outer line at least the inner + 1, else it
    // refuses the file's values), the viewer's above (an outer line 20), and a thickness leaving room inside the box (half its
    // smaller side less 3). All three written each time, so a file already outside them comes back inside
    propRows([['mem', 'Membrane', 'num', ' min="2" max="100"', 'Membrane thickness: the band between the two lines, 2 at least'],
      ['outer', 'Outer line', 'num', ' min="2" max="20"', 'Outer line width, at least the inner line + 1'],
      ['inner', 'Inner line', 'num', ' min="1" max="19"', 'Inner line width, 1 at least']]);
    // a species' structural state as one row (one field, as it is one), after
    // the compartment's rows; its text, empty for none; residues stay on the right-click (many, each its own list)
    propRows([['ss', 'Structural state', 'text', '', 'The species\u2019 structural state, free text; emptied, it is removed']]);
    }
    function cdDouble(k, x, ids) {
      if (!isFinite(x)) return false;
      var clamp = function (v, a, b) { return Math.min(Math.max(v, a), b); };
      return cdApply(function (t) {
        ids.forEach(function (id) {
          var L = cdMk.look(t, id), b = cdMk.aliasInfo(t, id).box, o = { mem: L.mem, outer: L.outer, inner: L.inner };
          o[k] = x;
          o.mem = clamp(o.mem, 2, b ? Math.max(2, Math.min(b[2], b[3]) / 2 - 3) : 100);
          o.outer = clamp(o.outer, 2, 20); o.inner = clamp(o.inner, 1, o.outer - 1);   // the outer line kept, the inner one fitted under it
          t = cdMk.restyle(t, id, o);
        });
        return t;
      }, ids);   // nothing written (the values already there): the field shows them again
    }

    // a sign dragged from the palette: CellDesigner's shape at its size following the pointer (create.js palDrag), drawn
    // as cdrender draws it once dropped (D.shape, outline: RNA slanted by its height, a protein's corners 5, a complex's
    // cut 5, a degraded circle 3/8 of the width with its stroke), so nothing changes shape on the drop
    function cdCompGhost(w, h, oval) {   // a new compartment as cdrender draws it (cd_make's COMP: its lines and band; its colour by Colours)
      var C = cdMk.COMP;
      return window.cdrender.compartmentShape(0, 0, w, h, C.thickness, C.outer, C.inner, '#' + (cdColour(shared.cd && shared.cd.now, 'COMPARTMENT') || C.colour).slice(2), oval);
    }
    function cdGhost(kind) {
      var cls = cdKind(kind), s = cdSize(cls), n = cdComp(cls) ? 1 : cdCopies(cls), e = 6 * (n - 1), w = s[0] - e, h = s[1] - e, k = cdCols() === 'custom' && cdKept()[cls],   // a kept multimer: its front one, the copies behind (as dropped)
        col = cdComp(cls) ? 'none' : '#' + (cdColour(shared.cd && shared.cd.now, cls) || cdMk.LOOK[cls][2]).slice(2), ink = ' fill="' + col + '" stroke="#000" stroke-width="' + (k && k.width > 0 && cls !== 'DEGRADED' ? k.width : 1) + '"';
      var shape = {
        PROTEIN: '<rect width="' + w + '" height="' + h + '" rx="5"' + ink + '/>', GENE: '<rect width="' + w + '" height="' + h + '"' + ink + '/>',
        RNA: '<path d="M' + h + ' 0H' + w + 'L' + (w - h) + ' ' + h + 'H0z"' + ink + '/>', SIMPLE_MOLECULE: '<ellipse cx="' + w / 2 + '" cy="' + h / 2 + '" rx="' + w / 2 + '" ry="' + h / 2 + '"' + ink + '/>',
        UNKNOWN: '<ellipse cx="' + w / 2 + '" cy="' + h / 2 + '" rx="' + w / 2 + '" ry="' + h / 2 + '" fill="' + col + '"/>',
        PHENOTYPE: '<path d="M' + h / 2 + ' 0H' + (w - h / 2) + 'L' + w + ' ' + h / 2 + 'L' + (w - h / 2) + ' ' + h + 'H' + h / 2 + 'L0 ' + h / 2 + 'z"' + ink + '/>',
        DEGRADED: '<circle cx="' + w / 2 + '" cy="' + h / 2 + '" r="' + w * 3 / 8 + '"' + ink + '/><path d="M' + w * 0.7 + ' 0L' + w * 0.3 + ' ' + h + '" stroke="#000"/>',
        COMPLEX: '<path d="M5 0H' + (w - 5) + 'L' + w + ' 5V' + (h - 5) + 'L' + (w - 5) + ' ' + h + 'H5L0 ' + (h - 5) + 'V5z"' + ink + ' stroke-width="2"/>',
        COMPARTMENT: cdCompGhost(w, h, false), OVAL: cdCompGhost(w, h, true)
      }[cls];
      for (var j = n - 1, back = ''; j > 0; j--) back += '<g transform="translate(' + 6 * j + ' ' + 6 * j + ')">' + shape + '</g>';
      return { w: s[0], h: s[1], svg: '<svg width="100%" height="100%" viewBox="0 0 ' + s[0] + ' ' + s[1] + '" overflow="visible">' + (back || '') + shape + '</svg>' };
    }

    export function __start() { __run1(); __run2(); __run3(); __run5(); __run6(); __run7(); __run8(); __run9(); __run10(); __run12(); __run13(); __run14(); __run15(); __run16(); __run17(); __run18(); __run19(); __run20(); __run21(); __run22(); __run23(); __run24(); __run25(); __run27(); __run28(); __run29(); __run30(); __run31(); __run32(); __run33(); }   // the part's statements, in their order
    export { CD_DEF_KEY, CD_GATE, PF_CD, cdCardDown, cdCheck, cdClick, cdClsOf, cdDeleteItem, cdFeat, cdFill, cdFront, cdGateMarks, cdGhost, cdHow, cdInfo, cdItems, cdKind, cdLineAt, cdLink, cdLinkMarks, cdLiveEnds, cdMake, cdMoveSays, cdNameDown, cdNameOf, cdOnLine, cdOverMarks, cdPal, cdRename, cdRole, cdSsTyped, cdStartOk, cdSvDelete, cdSvList, cdSvMove, cdSvOpen };
