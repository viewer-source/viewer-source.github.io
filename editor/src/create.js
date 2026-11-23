import { shared, V } from './state.js';
import { G, GE, HANDLE, MODS, Y, at, box, boxOf, cdOwn, changed, commit, complexHere, cutShape, doc, edges2, editing, f1, fmt, full, gE, gN, gridSet, grown, hit, holder, holderSize, holds, hubPorts, inComplex, inRim, keyTake, kindWindow, landMarks, lateItem, layTool, map, moveFix, name, nodes2, num, on, origFromFolder, origToFolder, outlineD, overlap, ownMenus, paint, parse, parseFix, quiet, rclick, realizerOf, refit, regroup, remember, render, rimOf, roleOf, roomy, setBoxes, setPort, setText, settle, site, src, subItem, sx, sy, takes, toGrid, under, undo, unpush, warn, x0, y0 } from './core.js';
import { bx, liveOff, livePose, sizeOff } from './live.js';
import { cdMk, cdNow, cdRebuild } from './celldesigner.js';
import { GEO, edOf, sbJs, sbKind } from './sbgn.js';
import { CD_DEF_KEY, CD_GATE, PF_CD, cdCardDown, cdClick, cdClsOf, cdDeleteItem, cdFeat, cdFill, cdFront, cdGateMarks, cdGhost, cdHow, cdInfo, cdItems, cdKind, cdLineAt, cdLink, cdLinkMarks, cdLiveEnds, cdMake, cdMoveSays, cdNameDown, cdNameOf, cdOnLine, cdOverMarks, cdPal, cdRename, cdRole, cdSsTyped, cdStartOk, cdSvDelete, cdSvList, cdSvMove, cdSvOpen } from './cdcreate.js';
import { origGh, origPut } from './own.js';
import NT from '../../renderers/converter/notation.js';   // the notation's kinds and rules table (plan 3 step 6)

    // ---------- making new things: the palette (editor/src/create.js) ----------
    // The full editor: entities taken from a palette in the Edit window, as in yEd and Newt. A click on
    // a sign takes it for one use: the next click on the map puts it there and the sign lets go; a double click keeps it
    // in hand for several in a row, until a click on the sign again or Esc; a sign
    // dragged onto the map is put where it is dropped. The pointer stays the plain arrow. Only with Settings, Editing on
    // Full, and on SBGN-ML maps: sbgn_edit (renderers/converter/sbgn_edit.js, its master, tested against the
    // converter by tests/sbgn-create.js) writes what is made into the editor's GraphML as the converter writes it, and
    // into the SBGN-ML file. Made here: a macromolecule, its name, its state variables (added from the right-click menu over
    // a macromolecule, not from the palette), its units of
    // information (free text, typed in SBGN's notation), a multimer or a
    // single macromolecule again (right-click Make multimer, Make macromolecule), and deleting them; a simple chemical,
    // 40 by 40 at the map's scale, with its name only (no state variable or unit of information on it,
    // though SBGN allows them: CellDesigner keeps none, and they are rarely used there).
    // Nothing asks for a name when made: a double click on a named entity or a
    // state variable, or a click on a state variable already selected, opens its text in place, in the glyph's own
    // colours and font; Enter or a click elsewhere keeps it, Esc not.
    // The other glyphs (perturbing agent, phenotype, nucleic acid feature, empty set,
    // complex, submap, compartment with line thickness 2 pixels, unspecified entity; nothing else of the
    // SBGN card): each made empty at its size (sbgn_edit SIZE), named by a double click (not the empty
    // set); a nucleic acid feature takes units of information from its right-click menu, ct:mRNA and ct:gene offered;
    // a complex is made empty, beside others (members by a drop onto it); a compartment lies under what is there, its border 2, and
    // takes in every glyph and compartment whose box lies fully inside it (regroup in core.js); any glyph made goes into
    // the innermost compartment that holds its box fully
    var PRESET;
    function __run1() {   // run at start, in order (__start)
    PRESET = { 'nucleic acid feature ct:gene': ['nucleic acid feature', ['ct:gene']], 'nucleic acid feature ct:mRNA': ['nucleic acid feature', ['ct:mRNA']] };
    }
    function baseKind(k) { return PRESET[k] ? PRESET[k][0] : k; }
    var PAL_PD, PHENO, OTHER, GATES_PD, ARC_PD, DELAY, INFL, ACT, ACT_UNIT, ACT_NAME, ACTS, PD_SIGN, ACTS_CD, NAF_ACT, NAF_CT, nafSplit, ACT_PROT, ACT_REST, ACT_REST_CD, PERT, LOGIC;
    function __run2() {   // run at start, in order (__start)
    PAL_PD = [   // groups named as SBGN's PD reference card, ordered
      // nodes first, the gates, the arcs last; the gates and the arcs each start a block of the one list (palSigns);
      // each sign fills the 24-unit box as far as the tools' own signs do (as large as the ? beside them)
      ['Entity pool nodes', [['macromolecule', 'Macromolecule', '<rect x="1.5" y="5" width="21" height="14" rx="3.5"/>'],
        ['simple chemical', 'Simple chemical', '<circle cx="12" cy="12" r="7"/>'],   // as tall as the macromolecule's sign
        // two presets in place of the bare one (conceptual type gene and conceptual type mRNA, so the kind is always clear
        // and compatible: CellDesigner has a gene and an RNA, no nucleic acid feature): each
        // made with its unit of information (PRESET), which can be retyped or deleted as any other; the signs' words centred
        // in the shape at one size, mRNA in its own capitals (the unit made stays ct:mRNA)
        ['nucleic acid feature ct:gene', 'Nucleic acid feature, ct:gene', '<path d="M1.5 5h21v9.5q0 4.5-4.5 4.5h-12q-4.5 0-4.5-4.5z"/><text x="12" y="14" text-anchor="middle" font-size="5.5">gene</text>'],
        ['nucleic acid feature ct:mRNA', 'Nucleic acid feature, ct:mRNA', '<path d="M1.5 5h21v9.5q0 4.5-4.5 4.5h-12q-4.5 0-4.5-4.5z"/><text x="12" y="14" text-anchor="middle" font-size="5.5">mRNA</text>'],
        ['unspecified entity', 'Unspecified entity', '<ellipse cx="12" cy="12" rx="10.5" ry="7"/>'],
        ['complex', 'Complex', '<path d="M6 4h12l4 4v8l-4 4h-12l-4-4v-8z"/>'],
        ['perturbing agent', 'Perturbing agent', '<path d="M1.5 5h21l-3.5 7 3.5 7h-21l3.5-7z"/>'],
        ['source and sink', 'Empty set (source and sink)', '<circle cx="12" cy="12" r="8"/><path d="M4 20l16-16"/>']]],
      // processes (process, omitted, uncertain; no association or dissociation, by choice): a bare
      // square, its antennas grown by its first arc; the other kinds from its right-click menu too
      ['Process nodes', [['process', 'Process', '<rect x="5" y="5" width="14" height="14"/>'],
        ['omitted process', 'Omitted process', '<rect x="5" y="5" width="14" height="14"/><path d="M9 15l2.5-6M12.5 15l2.5-6" class="in"/>'],
        ['uncertain process', 'Uncertain process', '<rect x="5" y="5" width="14" height="14"/><path d="M9.8 10.2a2.2 2.2 0 1 1 3.2 2c-.7.4-1 .8-1 1.6" class="in"/><circle class="dot" cx="12" cy="16.4" r=".8"/>'],
        ['phenotype', 'Phenotype', '<path d="M6 5h12l4.5 7-4.5 7h-12l-4.5-7z"/>']]],
      // the card's one-sign sections (Container Nodes, Encapsulation Node) joined, as Newt's Other nodes (no
      // group of a single sign)
      ['Other nodes', [['compartment', 'Compartment', '<rect x="1.5" y="3" width="21" height="18" rx="4.5" stroke-width="2.2"/>'],
        ['submap', 'Submap', '<rect x="1.5" y="4" width="21" height="16"/>'],
        // a tag: dropped on a submap's border it is that submap's terminal, sliding along it; elsewhere a free tag. Only
        // with the palette's CellDesigner compatible unticked (CellDesigner has neither; compat()); its sign the
        // macromolecule's box with the phenotype's point
        ['tag', 'Tag / terminal', '<path d="M1.5 5h16.5l4.5 7-4.5 7h-16.5z"/>']]],
      // logic gates (with SBGN's equivalence operator), a
      // circle with its word or sign, made bare as a process, its antennas grown by its arcs; marks inside a sign are class
      // 'in', a dot class 'dot', letters plain <text>: their weight is the Edit window's one rule (atlas-app.html, Sign weights)
      ['Logical operators', [['and', 'AND', '<circle cx="12" cy="12" r="10"/><text x="12" y="14.7" text-anchor="middle" font-size="7.4" letter-spacing="-.1">AND</text>'],
        ['or', 'OR', '<circle cx="12" cy="12" r="10"/><text x="12" y="14.9" text-anchor="middle" font-size="8.2">OR</text>'],
        ['not', 'NOT', '<circle cx="12" cy="12" r="10"/><text x="12" y="14.7" text-anchor="middle" font-size="7.4" letter-spacing="-.1">NOT</text>'],
        ['equivalence', 'Equivalence', '<circle cx="12" cy="12" r="10"/><path d="M7.5 8.8h9M7.5 12h9M7.5 15.2h9" class="in"/>']], true],
      // arcs: drawn by a drag from a node with the arc's sign picked
      ['Connecting arcs', [['consumption', 'Consumption / logic arc', '<path d="M3 12h18"/>'],
        ['production', 'Production', '<path d="M3 12h11"/><path d="M13 7.5l8 4.5-8 4.5z" fill="currentColor"/>'],
        // the modulations, by use: catalysis, the most used, first; modulation, the least used, last
        ['catalysis', 'Catalysis', '<path d="M3 12h12"/><circle cx="18" cy="12" r="3"/>'],
        ['stimulation', 'Stimulation', '<path d="M3 12h10"/><path d="M13 7.5l8 4.5-8 4.5z"/>'],
        ['inhibition', 'Inhibition', '<path d="M3 12h17M20 6v12"/>'],
        ['necessary stimulation', 'Necessary stimulation', '<path d="M3 12h10M10 7v10"/><path d="M13 7.5l8 4.5-8 4.5z"/>'],
        ['modulation', 'Modulation', '<path d="M3 12h10"/><path d="M13 12l4-4 4 4-4 4z"/>']], true]
    ];
    // Activity Flow (two tabs, PD and AF, and under AF the
    // view, Reduced notation (CellDesigner) or SBGN: one set of rules, two ways of drawing the nodes). A node made in either
    // view is the same glyph in the file: a biological activity whose unit of information holds its entity (none for a
    // protein's; sbgn_edit write), drawn in the SBGN view as the activity (a sharp-cornered rectangle, the unit small at
    // its top right), in the reduced notation view as the entity itself. No processes, no empty set, no consumption or production, no catalysis (AF has
    // none); the four influences of the AF reference card under its names; the delay (tau) added to the gates, the
    // equivalence kept (AF lacks it only because its specification was not updated)
    PHENO = PAL_PD[1][1].filter(function (q) { return q[0] === 'phenotype'; })[0], OTHER = PAL_PD[2];
    GATES_PD = PAL_PD[3][1], ARC_PD = {};
    PAL_PD[4][1].forEach(function (q) { ARC_PD[q[0]] = q; });
    DELAY = ['delay', 'Delay', '<circle cx="12" cy="12" r="10"/><text x="12" y="17" text-anchor="middle" font-size="14" font-family="Times New Roman, serif" fill="currentColor" stroke="none">\u03c4</text>'];
    INFL = [['stimulation', 'Positive influence'], ['inhibition', 'Negative influence'], ['modulation', 'Unknown influence'], ['necessary stimulation', 'Necessary stimulation']];
    // the activities, all the same size: Activity, a sharp rectangle with no unit (a protein's, as SBGN's AF examples), then one for each
    // entity with its unit at the top right (sbgn_edit.afUnitBox), the protein's twice as wide as high, the metabolite's a
    // circle; the rectangle's top edge left open under the unit, the unit an inner mark (Sign weights). ACT_UNIT: the
    // unit each makes ('' none). The logic arc, the bare line into a gate, its own sign here
    ACT = ['activity', 'Activity', '<rect x="1.5" y="5" width="21" height="14"/>'];
    ACT_UNIT = { activity: '' }, ACT_NAME = {};   // the palette's kind -> its unit, and back
    ACTS = [ACT].concat([['macromolecule', 'Protein activity', '<rect x="10.5" y="2.5" width="10" height="5" rx="1.6"/>', 10.5, 20.5],
      ['simple chemical', 'Metabolite activity', '<circle cx="18" cy="5" r="2.5"/>', 15.5, 20.5],
      ['nucleic acid feature', 'Nucleic acid feature activity', '<path d="M10.5 2.5h10v3.4q0 1.6-1.6 1.6h-6.8q-1.6 0-1.6-1.6z"/>', 10.5, 20.5],
      ['complex', 'Complex activity', '<path d="M12 2.5h7l1.5 1.5v2l-1.5 1.5h-7l-1.5-1.5v-2z"/>', 10.5, 20.5],
      ['unspecified entity', 'Unspecified entity activity', '<ellipse cx="15.5" cy="5" rx="5" ry="2.5"/>', 10.5, 20.5]].map(function (q) {
      var kind = q[1].toLowerCase();
      ACT_UNIT[kind] = q[0]; ACT_NAME[q[0]] = kind;
      return [kind, q[1], '<path d="M' + q[3] + ' 5H1.5v14h21V5H' + q[4] + '"/><g class="in">' + q[2] + '</g>'];
    }));
    // the reduced notation view's activities (drawn there as the simple entity, in the SBGN
    // view as the activity): the kinds of ACTS, so the file is the same whichever view drew them, as the entity glyphs (the
    // PD palette's signs), SBGN's names kept in either view; no bare Activity, the protein's being it: saved with no
    // unit, as the SBGN view's Activity (a protein's activity gets no unit by default), the others with theirs
    PD_SIGN = {}; PAL_PD[0][1].forEach(function (q) { PD_SIGN[q[0]] = q[2]; });
    PD_SIGN['nucleic acid feature'] = '<path d="M1.5 5h21v9.5q0 4.5-4.5 4.5h-12q-4.5 0-4.5-4.5z"/>';
    ACTS_CD = ['macromolecule', 'simple chemical', 'nucleic acid feature', 'complex', 'unspecified entity'].map(function (c) {
      var k = ACT_NAME[c]; return [c === 'macromolecule' ? 'activity' : k, ACTS.filter(function (q) { return q[0] === k; })[0][1], PD_SIGN[c]];
    });
    // a nucleic acid feature's activity as two presets, in both views (gene told apart
    // from mRNA; the AF specification's conceptual types, text in the unit as SBGN-ML keeps it): made with the unit's
    // text ct:gene or ct:mRNA (PRESET), retyped or removed from its right-click menu; the signs' words as the PD presets'
    NAF_ACT = 'nucleic acid feature activity', NAF_CT = [['ct:gene', 'gene'], ['ct:mRNA', 'mRNA']];   // the conceptual types and their signs' words
    NAF_CT.forEach(function (q) { PRESET[NAF_ACT + ' ' + q[0]] = [NAF_ACT, [q[0]]]; });
    nafSplit = function (set, sbgnLook) {
      return [].concat.apply([], set.map(function (q) {
        if (q[0] !== NAF_ACT) return [q];
        return NAF_CT.map(function (c) {
          var sign = sbgnLook ? q[2] + '<text x="12" y="15.9" text-anchor="middle" font-size="5.5">' + c[1] + '</text>' : PAL_PD[0][1].filter(function (p) { return p[0] === 'nucleic acid feature ' + c[0]; })[0][2];
          return [NAF_ACT + ' ' + c[0], q[1] + ', ' + c[0], sign];
        });
      }));
    };
    ACTS = nafSplit(ACTS, true); ACTS_CD = nafSplit(ACTS_CD, false);
    // Protein auxiliary unit (a tick box: what is seen is what the file gets; ticked, the palette's protein activity
    // has the protein box): the first sign of both views is the protein's activity, in the SBGN
    // view the sharp rectangle with the protein's box when ticked (Protein activity, its unit a macromolecule), plain when
    // not (Activity, no unit); in the reduced notation view the protein's sign either way (the
    // glyph is drawn there as the entity); then the other kinds as before
    ACT_PROT = ACTS.filter(function (q) { return q[0] === 'protein activity'; })[0];
    ACT_REST = ACTS.filter(function (q) { return q !== ACT && q !== ACT_PROT; }), ACT_REST_CD = ACTS_CD.filter(function (q) { return q[0] !== 'activity'; });
    PERT = ['perturbing agent', 'Perturbation', PAL_PD[0][1].filter(function (q) { return q[0] === 'perturbing agent'; })[0][2]];
    LOGIC = ['logic arc', 'Logic arc', '<path d="M3 12h18"/>'];
    }
    function palAf(sbgnLook, prot) {
      var first = prot ? ACT_PROT : ACT;   // in the reduced notation view its sign the protein's, as drawn there (no box on entities), as the view's other signs
      return [
        ['Activity nodes', [sbgnLook ? first : [first[0], first[1], PD_SIGN.macromolecule]].concat(sbgnLook ? ACT_REST : ACT_REST_CD, [PHENO, PERT])],
        OTHER,
        ['Logical operators', GATES_PD.concat([DELAY]), true],
        ['Arcs', INFL.map(function (x) { var q = ARC_PD[x[0]]; return [q[0], sbgnLook || x[0] === 'necessary stimulation' ? x[1] : q[1] + ' (' + x[1].toLowerCase() + ')', q[2]]; }).concat([LOGIC]), true]
      ];
    }
    var PALS, ARCS, MODK;
    function __run3() {   // run at start, in order (__start)
    PALS = { pd: PAL_PD, rn: palAf(false), sbgn: palAf(true), rnP: palAf(false, true), sbgnP: palAf(true, true) };
    ARCS = {}, MODK = {};   // the signs that draw an arc, not a glyph (Connecting arcs, Modulating arcs), and among them the modulations
    PAL_PD[4][1].forEach(function (q) { ARCS[q[0]] = 1; if (!/^(consumption|production)$/.test(q[0])) MODK[q[0]] = 1; });   // sbgn_edit loads later
    ARCS['logic arc'] = 1;
    }
    function arcTool() { return tool && ARCS[tool.kind] ? tool.kind : null; }
    var tool, pal, PAL_KEY, palSet;
    function __run4() {   // run at start, in order (__start)
    tool = null;   // { kind, sticky } in hand
    pal = document.createElement('div');
    pal.className = 'm2-ed-palette'; pal.hidden = true; pal.setAttribute('role', 'toolbar'); pal.setAttribute('aria-label', 'Palette');
    // which set the palette shows: PD or AF, and AF's look, per map in this browser; a map not chosen yet
    // starts on what its file is (an Activity Flow file AF in the SBGN view, else PD)
    PAL_KEY = 'atlas-edit-palette', palSet = { lang: 'pd', look: 'rn' };
    }
    function palStore() { try { return JSON.parse(localStorage.getItem(PAL_KEY)) || {}; } catch (e) { return {}; } }
    function palId() { return site && (site.id || site.path) || name || null; }   // the map edited (V.current is the editor's own entry then)
    function palFor() {   // the map's choice, else from its file
      var all = palStore(), id = palId(), k = id && all[id];
      if (k && (k.lang === 'pd' || k.lang === 'af')) return { lang: k.lang, look: k.look === 'sbgn' ? 'sbgn' : 'rn', strict: k.strict === true, sbgn: k.sbgn === true };
      var af = sbJs.isAf(shared.sb && shared.sb.base);
      return { lang: af ? 'af' : 'pd', look: af ? 'sbgn' : 'rn', strict: false, sbgn: false };
    }
    function palKeep() { var all = palStore(), id = palId(); if (!id) return; all[id] = palSet; try { localStorage.setItem(PAL_KEY, JSON.stringify(all)); } catch (e) {} }
    function palSign(q) {
      return '<button type="button" data-make="' + q[0] + '" title="' + q[1] + (ARCS[q[0]] ? ': picked, a drag from one node to another draws it (click: once; double click: several)' : CD_GATE[q[0]] ? ': click its inputs, then the reaction\u2019s square or the target species (click: once; double click: several)' : ' (click: once; double click: several)') + '" aria-label="' + q[1] + '" aria-pressed="false">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' + q[2] + '</svg></button>';
    }
    // the one list in blocks: a group marked as starting a block (its third item, true) begins a new row, so the list reads
    // as a few small groups with no names; always at the panel's usual width, and on a narrowed panel kept while they cost
    // no row more than the plain list would at its width and every width below the usual one (palBlocks), else the plain
    // list, so a narrowed panel stays compact
    function palSigns(set) {
      var blocks = [];
      set.forEach(function (s, i) { if (!i || s[2]) blocks.push(0); blocks[blocks.length - 1] += s[1].length; });
      return '<div class="m2-ed-prow" data-blocks="' + blocks.join(',') + '">' + set.map(function (s, i) { return (i && s[2] ? '<span class="m2-ed-pbr" aria-hidden="true"></span>' : '') + s[1].map(palSign).join(''); }).join('') + '</div>';
    }
    // the notation, PD or AF, and with AF its look, as sign buttons in one row (icons that stay pressed,
    // so nothing in the Edit window draws the eye): PD and AF as letters at
    // about 13 px, as large as text buttons, the look as the glyph it draws, SBGN's
    // activity (a rectangle with the entity's shape on its top edge) or the entity itself (Reduced notation), the names in
    // the titles
    // what the map is, read from its file as it is now: sbgn_edit.mapKind, the one
    // master write() also decides by (empty, pd, hybrid, af), the file turned to it as it changes; read once per change of
    // the editor's GraphML (sbKind, sbgn.js), never for a paint
    function palKind() { return sbKind(); }
    // PD and AF only choose the palette, Activity Flow or Process Description, on every map, nothing else;
    // what the map is follows what is drawn (palKind, write)
    // Reduced notation, ticked by default (as CellDesigner's View, Change Toolbar Visible, Reduced Notation; the free way
    // by default, as in CellDesigner, unticked on purpose for the restriction, e.g. for teaching): under PD a modulation may end on an
    // entity, and a gate's output go to one, as CellDesigner's reduced notation, while ticked; per map in this browser
    // (`strict`, true when unticked)
    function hybOn() { return palLangNow() === 'pd' && palSet.strict !== true && !sbgnStrict(); }
    // Strict SBGN, unticked by default (per map in this browser, `sbgn`): ticked, what is drawn from then on keeps to the
    // SBGN PD specification alone (notation.js, the set strict): no reduced notation (its tick box shown pale, its own tick
    // kept), no proposed demerging links, a process's one catalysis and one necessary stimulation, an empty set's one line,
    // nothing from a phenotype; unticked, the specification and what CellDesigner allows beyond it (a phenotype a
    // reaction's reactant or modifier). What the map holds is never changed by it
    function sbgnStrict() { return palLangNow() === 'pd' && palSet.sbgn === true; }
    function palLangNow() { return palSet.lang === 'af' ? 'af' : 'pd'; }
    // the views (SBGN or CellDesigner) only where the map is pure Activity Flow or still empty (the AF SBGN view has no
    // process); elsewhere the reduced notation view, no switch shown
    function palViews() { var k = palKind(); return palLangNow() === 'af' && (k === 'af' || k === 'empty'); }
    // Activity Flow has no state variables, and an activity one unit of information: its shape the entity's kind, its text
    // free, set from the activity's right-click menu, never by a click on the unit
    function afMap() { return !!shared.sb && palOn() && palLangNow() === 'af'; }
    // the map itself Activity Flow (palKind), whichever palette is chosen: what a glyph's right-click menu offers and whether
    // its state variables are picked follow the map, never the tab (else the AF tab would take them from a PD map)
    function afKind() { return !!shared.sb && palKind() === 'af'; }
    function palLookNow() { return palViews() && palSet.look === 'sbgn' ? 'sbgn' : 'rn'; }
    function palBtn(attr, title, sign) { return '<button type="button" ' + attr + ' title="' + title + '" aria-label="' + title + '" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' + sign + '</svg></button>'; }
    function palView(look, name, title) { return '<button type="button" role="radio" data-look="' + look + '" title="' + title + '" aria-label="' + title + '" aria-checked="false"><span class="m2-ed-radio" aria-hidden="true"></span>' + name + '</button>'; }
    // the circled i beside the views and the tick boxes: its text in data-info, shown in the page's info window (.m2-itip, atlas-app.html)
    var INFO;
    function __run5() {   // run at start, in order (__start)
    INFO = {
      strict: 'Corresponds to CellDesigner\'s Reduced Notation. Stimulation, inhibition, necessary stimulation and modulation may also link entities, phenotypes and submaps. Such maps open in CellDesigner and MINERVA, but other SBGN-ML tools may not read them. Unticked, the SBGN Process Description rules alone. Off while Strict SBGN is ticked.',
      sbgn: 'Keeps what is drawn from now on to the SBGN Process Description specification alone: no reduced notation, one catalysis and one necessary stimulation per process, one line at an empty set, no line from a phenotype. Unticked, the default, the specification and what CellDesigner also allows, such as a phenotype as a reaction\'s reactant or modifier. What the map already holds is not changed.',
      rn: 'Corresponds to CellDesigner\'s Reduced Notation palette, which enables an Activity Flow type of representation.',
      sbgn: 'Follows the SBGN Activity Flow specification. The map is saved as an Activity Flow SBGN-ML file.',
      prot: 'When ticked, shows the auxiliary unit on protein activities. An activity with no auxiliary unit is by default a protein activity.',
      cdc: 'Keeps maps to what CellDesigner and MINERVA can hold. Unticked, the palette also offers tags, and submaps with terminals on their border. What a map already holds is not changed by it.'
    };
    }
    function palTip(line, name, t) {
      t = t.replace(/&/g, '&amp;').replace(/"/g, '&quot;');   // into attributes
      return '<div class="m2-ed-pline">' + line + '<button type="button" class="m2-ed-pinfo m2-ed-ptip m2-itip" aria-label="About ' + name + '" title="About ' + name + '" data-info="' + t + '" aria-expanded="false"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="8" cy="8" r="7.2" stroke-width="1.1"/><path d="M8 7.3v4.2" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="4.6" r="1.2" fill="currentColor" stroke="none"/></svg></button></div>';
    }
    var palSignsEl;
    function __run6() {   // run at start, in order (__start)
    pal.innerHTML = '<div class="m2-ed-prow m2-ed-pnot" role="group" aria-label="Notation">' +
      palBtn('data-lang="pd"', 'Process Description', '<text x="12" y="17.3" text-anchor="middle" font-size="15">PD</text>') +
      palBtn('data-lang="af"', 'Activity Flow', '<text x="12" y="17.3" text-anchor="middle" font-size="15">AF</text>') +
      '</div>' +
      // AF's two views as named round choices under the tabs (icons there would read as
      // glyphs to drag onto the map), shown only where the views apply (palViews)
      '<div class="m2-ed-plook" role="radiogroup" aria-label="Activity Flow view">' +
      palTip(palView('rn', 'Reduced notation view', 'Reduced notation view: each activity drawn as its entity'), 'Reduced notation view', INFO.rn) +
      palTip(palView('sbgn', 'SBGN AF view', 'SBGN Activity Flow view: each entity drawn as its SBGN activity'), 'SBGN Activity Flow view', INFO.sbgn) + '</div>' +
      '<div class="m2-ed-pblk m2-ed-pprot">' + palTip('<label class="m2-ed-phyb" title="Ticked: every protein activity carries the auxiliary unit of a macromolecule, drawn and saved in the file; unticked: none has it"><input type="checkbox"><span>Protein auxiliary unit</span></label>', 'Protein auxiliary unit', INFO.prot) + '</div>' +
      '<div class="m2-ed-pblk m2-ed-pcdc">' + palTip('<label class="m2-ed-phyb" title="Ticked: the palette offers only what CellDesigner and MINERVA can hold; unticked: tags and submaps\u2019 terminals too"><input type="checkbox"><span>CellDesigner compatible</span></label>', 'CellDesigner compatible', INFO.cdc) + '</div>' +
      '<div class="m2-ed-pblk m2-ed-psbgn">' + palTip('<label class="m2-ed-phyb" title="Ticked: what is drawn keeps to the SBGN PD specification alone; unticked: CellDesigner\u2019s additions too"><input type="checkbox"><span>Strict SBGN</span></label>', 'Strict SBGN', INFO.sbgn) + '</div>' +
      '<div class="m2-ed-pblk m2-ed-pstrict">' + palTip('<label class="m2-ed-phyb" title="Ticked (the default): under PD a modulation may also end on an entity, and a logic gate\u2019s output go to one (CellDesigner\u2019s reduced notation); with a process on the map the file stays Process Description, without one such a link makes it Activity Flow. Unticked: Process Description only"><input type="checkbox"><span>Reduced notation</span></label>', 'Reduced notation', INFO.strict) + '</div>' +
      '<div class="m2-ed-psigns"></div>';
    palSignsEl = pal.querySelector('.m2-ed-psigns');
    }
    function palBlocks() {   // the blocks of the one list shown, or the plain list (palSigns)
      var row = palSignsEl.querySelector('.m2-ed-prow[data-blocks]'), b = row && row.querySelector('button');
      if (!row || !b) return;
      var n = row.dataset.blocks.split(',').map(Number), all = n.reduce(function (a, x) { return a + x; }, 0);
      var gap = parseFloat(getComputedStyle(row).columnGap) || 0, step = b.offsetWidth + gap, most = parseFloat(getComputedStyle(pal).maxWidth) || row.clientWidth;
      var cols = Math.max(1, Math.floor((row.clientWidth + gap) / step)), top = Math.max(cols, Math.floor((most + gap) / step)), flat = false;
      for (var c = cols; c < top && !flat; c++) flat = n.reduce(function (a, x) { return a + Math.ceil(x / c); }, 0) > Math.ceil(all / c);
      row.classList.toggle('m2-ed-pflat', flat);
    }
    function __run7() {   // run at start, in order (__start)
    if (window.ResizeObserver) new ResizeObserver(palBlocks).observe(palSignsEl);
    }
    function palKey() { return palLangNow() === 'pd' ? 'pd' : palLookNow() + (protOn ? 'P' : ''); }
    // CellDesigner compatible, the palette's tick box above Reduced notation (kept in this browser for every map, undone as
    // a setting): ticked, the palette offers only what CellDesigner can hold; unticked, the palette adds the tag (and
    // the submap's terminals) and AF's delay (CellDesigner has no delay, the converter joins its input to its target; the
    // equivalence stays, written as CellDesigner's unknown gate); a missing key reads unticked. What a map already holds is never changed by it. Not shown on
    // a CellDesigner map, whose palette is CellDesigner's own
    var EXTENDED, CDC_KEY;
    function __run8() {   // run at start, in order (__start)
    EXTENDED = { tag: 1, delay: 1 };
    CDC_KEY = 'atlas-cd-compatible';
    }
    function compat() { try { return localStorage.getItem(CDC_KEY) === 'on'; } catch (e) { return false; } }
    function palSet0(set) { return compat() ? set.map(function (g) { return [g[0], g[1].filter(function (q) { return !EXTENDED[q[0]]; }), g[2]]; }) : set; }
    // the tick box's state lives in the file: on opening, ticked when the map's protein activities all
    // carry the protein's unit, unticked when none or some do; read again after every change where they all agree (an
    // undo of the tick included), kept where they are mixed or there are none, so new protein activities follow it
    var protOn, protMemo;
    function __run9() {   // run at start, in order (__start)
    protOn = false, protMemo = [null, null];
    }
    function protFile() {   // true: every protein activity has the box; false: none; null: mixed, or no protein activity (one whose unit has text not counted: it keeps its unit either way)
      if (protMemo[0] === shared.text) return protMemo[1];
      var A = sbJs.activities(shared.text, null, true), u = Object.keys(A).map(function (k) { return A[k]; }).filter(function (x) { return x === '' || x === 'macromolecule'; });
      var r = !u.length ? null : u.every(function (x) { return x === 'macromolecule'; }) ? true : u.every(function (x) { return x === ''; }) ? false : null;
      protMemo = [shared.text, r];
      return r;
    }
    // the map's own choices for new nodes (Style, Colours) in a block of their own under the palette (pmap), shown where
    // Properties is while nothing is selected: rows as Properties' (the name, then a field with its arrow), the field's
    // list a small window of its own over the page, as a graph editor's drop-down: the field's width at least, under the
    // field, above it where the window has no room below; closed by a choice, Escape, a press elsewhere, a scroll or a
    // resize. Rows in the order made.
    // o: { key, label, title, list: [[id, name, title]], get(), set(id), sq(id): the choice's squares as HTML, or none }
    var pmap, ddOpen;
    function __run10() {   // run at start, in order (__start)
    pmap = document.createElement('div'); pmap.className = 'm2-ed-pmap'; pmap.hidden = true;
    pmap.innerHTML = '<table class="m2-ed-ptab"></table>';
    ddOpen = null;
    }   // the open list's window (_r: its row, _t and _list: the map and choices it was made from)
    function ddClose() {
      if (!ddOpen) return;
      var f = ddOpen._r.querySelector('.m2-ed-pdd'), back = ddOpen._keys && ddOpen.contains(document.activeElement);
      f.setAttribute('aria-expanded', 'false');
      ddOpen.remove(); ddOpen = null;
      if (back) f.focus();   // opened by the keys: the focus back on its field
    }
    function __run11() {   // run at start, in order (__start)
    document.addEventListener('pointerdown', function (e) { if (ddOpen && !ddOpen.contains(e.target) && !ddOpen._r.contains(e.target)) ddClose(); }, true);
    // the list's keys, before the editor's own (arrows would also move the selection): up and down walk the choices,
    // Enter or Space choose (the focused button's own click), Escape closes the list only; another key (Tab too) closes it and goes on
    document.addEventListener('keydown', function (e) {
      if (!ddOpen || e.key === 'Enter' || e.key === ' ' || /^(Shift|Control|Alt|Meta)$/.test(e.key)) return;
      if (!/^(ArrowDown|ArrowUp|Escape)$/.test(e.key)) { ddClose(); return; }
      e.stopImmediatePropagation(); e.preventDefault();
      if (e.key === 'Escape') { ddClose(); return; }
      var list = Array.prototype.slice.call(ddOpen.querySelectorAll('button')); if (!list.length) return;
      var i = list.indexOf(document.activeElement), d = e.key === 'ArrowDown' ? 1 : -1;
      if (i < 0) i = list.findIndex(function (b) { return b.getAttribute('aria-selected') === 'true'; });
      list[i < 0 ? (d > 0 ? 0 : list.length - 1) : (i + d + list.length) % list.length].focus();
    }, true);
    window.addEventListener('resize', ddClose);
    document.addEventListener('scroll', function (e) { if (ddOpen && !ddOpen.contains(e.target)) ddClose(); }, true);
    }
    function palDrop(o) {
      var r = pmap.querySelector('tr[data-k="' + o.key + '"]');
      if (!r) {
        r = document.createElement('tr'); r.dataset.k = o.key;
        r.innerHTML = '<th></th><td><button type="button" class="m2-ed-pdd" aria-haspopup="listbox" aria-expanded="false"><span></span><svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button></td>';
        var bx = r.querySelector('button');
        bx.addEventListener('click', function (e) {
          e.stopPropagation();
          var was = ddOpen && ddOpen._r === r, keys = e.detail === 0; ddClose(); bx.blur();   // the editor's keys work at once
          if (was) return;
          var q = r._o, m = q.get(), box = document.createElement('div');
          box.className = 'm2-cx m2-ed-pdl'; box.setAttribute('role', 'listbox'); box.setAttribute('aria-label', q.label);
          q.list.forEach(function (c) {
            var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(c[0] === m));
            b.title = c[2];
            b.innerHTML = '<span>' + c[1] + '</span>' + (q.sq ? q.sq(c[0]) : '');
            b.addEventListener('click', function (ev) { ev.stopPropagation(); var same = box._t === src(); ddClose(); if (same) { q.set(c[0]); palDrop(q); } });   // the map it was opened on
            box.appendChild(b);
          });
          document.body.appendChild(box);
          // under the field, its left edge on the field's and at least its width; above it where the window has no room
          // below and more above; inside the window. The page's own zoom: a fixed box is placed in its units
          var f = bx.getBoundingClientRect(), k = box.getBoundingClientRect().width / box.offsetWidth || 1;
          box.style.minWidth = f.width / k + 'px';
          var w = box.offsetWidth * k, h = box.offsetHeight * k, below = V.winH() - 4 - f.bottom, above = f.top - 4;
          var y = h + 2 * k <= below || below >= above ? f.bottom + 2 * k : f.top - 2 * k - h;
          box.style.left = Math.max(4, Math.min(f.left, V.winW() - 4 - w)) / k + 'px';
          box.style.top = Math.max(4, Math.min(y, V.winH() - 4 - h)) / k + 'px';
          ddOpen = box; box._r = r; box._t = src(); box._list = q.list; box._keys = keys; bx.setAttribute('aria-expanded', 'true');
          if (keys) { var s = box.querySelector('[aria-selected="true"]') || box.firstChild; if (s) s.focus(); }   // opened by Enter or Space (detail 0: no pointer): the keys walk the list
        });
        pmap.firstChild.appendChild(r);
      }
      r._o = o;
      if (ddOpen && ddOpen._r === r && (ddOpen._t !== src() || ddOpen._list !== o.list)) ddClose();   // the map changed (an edit, an undo, another format): its squares and choices would be stale
      var th = r.firstChild, f = r.querySelector('.m2-ed-pdd'), cur = o.get(), v = o.list.filter(function (c) { return c[0] === cur; })[0][1];
      if (th.textContent !== o.label) th.textContent = o.label;
      if (f.title !== o.title) { f.title = o.title; f.setAttribute('aria-label', o.label + ', ' + o.title); }
      if (f.firstChild.textContent !== v) f.firstChild.textContent = v;   // written only when changed (every paint comes here)
      return r;
    }
    // Style and Colours belong to the map: kept per map in this browser (map -> { style, cols }), as the palette's set is
    // (PAL_KEY), so another map opened shows its own. Colours a map was given no choice on are read from the map (mapCols)
    var CHOICE_KEY, choiceMemo;
    function __run12() {   // run at start, in order (__start)
    CHOICE_KEY = 'atlas-edit-map-choices', choiceMemo = {};
    try { ['atlas-edit-style', 'atlas-edit-sb-colours', 'atlas-edit-cd-colours'].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
    }   // the earlier choices for every map at once
    function choicesKept() { try { return JSON.parse(localStorage.getItem(CHOICE_KEY)) || {}; } catch (e) { return {}; } }
    function mapChoice(what, ids) { var id = palId(), k = id && choicesKept()[id], v = k && k[what]; return ids.indexOf(v) >= 0 ? v : null; }
    function keepMapChoice(what, v) {
      var all = choicesKept(), id = palId();
      choiceMemo = {};
      if (!id) return;
      (all[id] = all[id] || {})[what] = v;
      try { localStorage.setItem(CHOICE_KEY, JSON.stringify(all)); } catch (e) {}
    }
    // Original, Colours' first choice: the map's own colours. Taken (the format's colours(), by element) when another
    // choice is made while the map is in its own colours, kept per map in this browser and with the map on GitHub
    // (own.js origPut) or in the folder (core.js origToFolder), and put back by Original, each
    // element the record knows; one added since keeps its colour, and the map as it then is is its own again (taken at
    // the next choice). New glyphs under Original: the colour most of their kind have on the map
    var ORIG_KEY;
    function __run13() {   // run at start, in order (__start)
    ORIG_KEY = 'atlas-edit-originals';
    }
    function origAll() { try { return JSON.parse(localStorage.getItem(ORIG_KEY)) || {}; } catch (e) { return {}; } }
    function origKeep(id, r) { var all = origAll(); all[id] = r; try { localStorage.setItem(ORIG_KEY, JSON.stringify(all)); return true; } catch (e) { return false; } }
    var pickSeq;
    function __run14() {   // run at start, in order (__start)
    pickSeq = 0;
    }
    function colsPick(v, cur, take, back, recolour) {   // a choice of Colours on the map (cur: the one it shows): take its own colours, put them back, or recolour
      var id = palId(), seq = ++pickSeq;
      if (v === 'file') {
        if (!id) { keepMapChoice('cols', 'file'); return; }
        var mine0 = origAll()[id] || null, s0 = site;
        Promise.all([origGh(), origFromFolder(id)]).then(function (o) {
          if (seq !== pickSeq || !on || site !== s0 || palId() !== id) return;   // another choice, map or Done meanwhile
          var r = [o[0], o[1]].reduce(function (a, x) { return x && typeof x === 'object' && (x.fill || x.node) && (!a || (x.at || 0) > (a.at || 0)) ? x : a; }, mine0);   // the newest: GitHub's, the folder's or this browser's
          if (r && r !== mine0) origKeep(id, Object.assign({}, r, { sent: r === o[0] ? 1 : undefined }));   // kept here too, so the field reads it
          keepMapChoice('cols', 'file');   // only now: a choice made while GitHub was asked still saw the map's scheme (no record taken from it)
          if (!r) { paint(); return; }   // no colours of this map kept: the map stays as it is, nothing said
          back(r);
          paint();
        });
        return;
      }
      if (id && cur === 'file') {   // the map in its own colours, as the field shows (after an undo too)
        var r = take(), was = origAll()[id], bare = function (o) { return JSON.stringify(Object.assign({}, o, { at: 0, sent: 0 })); };
        var same = !!was && bare(was) === bare(r);
        r.at = same ? was.at : Date.now();
        if (same && was.sent) r.sent = was.sent;
        if (!origKeep(id, r)) warn('The map\u2019s own colours could not be kept in this browser.');
        origToFolder(id, r);   // without a token, the folder's hidden .viewer/ (core.js); a map not in the folder yet gets it with its first file
        if (!r.sent) origPut(r, function () { var all = origAll(); if (all[id] && all[id].at === r.at) { all[id].sent = 1; origKeep(id, all[id]); } });   // GitHub once per change of the colours (own.js)
      }
      keepMapChoice('cols', v); recolour(v);
    }
    // the map's Colours: the choice kept for it while the map still shows it (Custom always); else the first
    // of ids the map shows (is: every filled glyph as that choice colours it, its lines apart; Confetti every one a confetti
    // pastel), else Original. So a map recoloured elsewhere, or a recolour undone, shows what the map now is. Read once per
    // change of the map
    // is(m): true, false, or null where the map has nothing to read (an empty map: a kept choice stands, none is read).
    // An SBGN-ML map's moves and resizes change no colour: read again only when more than places changed (sbgn.js GEO)
    function mapCols(ids, is) {
      var id = palId(), b = shared.cd ? shared.cd.now : null, M = choiceMemo;
      if (M.id === id && M.t === shared.text && M.b === b) return M.v;
      var key = shared.cd ? null : shared.text.replace(GEO, '');
      if (M.id === id && !shared.cd && M.key === key) { M.t = shared.text; return M.v; }
      var k = mapChoice('cols', ids), v = k === 'custom' || (k && is(k) !== false) ? k : null;   // Original while the map has its kept colours (or none were kept)
      if (!v) ids.some(function (m) { return m !== 'file' && m !== 'custom' && is(m) === true && (v = m); });
      choiceMemo = { id: id, t: shared.text, b: b, key: key, v: v || 'file' };
      return choiceMemo.v;
    }
    // Style, the sizes of new nodes, kept per map (mapChoice): the size most nodes of that kind
    // have on the map (sbgn_edit.defaults, cd_make.classSize; the built-in size where it has none), or the built-in sizes
    // Custom: the size kept by Set as default for that kind (each format keeps its own: atlas-edit-defaults,
    // atlas-edit-cd-defaults), From map for a kind with none
    var STYLES;
    function __run15() {   // run at start, in order (__start)
    STYLES = [['file', 'From map', 'New nodes the size most nodes of their kind have on this map'], ['default', 'Standard sizes', 'New nodes at the standard sizes: CellDesigner\u2019s own on a CellDesigner map, the editor\u2019s on others'], ['custom', 'Custom default', 'New nodes the size kept by Set as default; From map for a kind with none']];
    }
    function palStyle() { return mapChoice('style', ['file', 'default', 'custom']) || 'file'; }
    function styleRow() { return palDrop({ key: 'style', label: 'Style', title: 'Sizes of new nodes', list: STYLES, get: palStyle, set: function (v) { palDid([CHOICE_KEY], function () { keepMapChoice('style', v); }); } }); }
    // Confetti, a choice of both palettes' Colours: every new entity a pastel of its own, whatever its kind (processes,
    // gates, empty sets and compartments keep From map's look). The hues are the golden-angle sequence (k times 137.508
    // degrees), HSL saturation 55% and lightness 82%, so black text reads on each; of the first 64 hues, the one farthest
    // from every clearly coloured hue already on the map (chroma above 0.08, so near-white and near-black tints count for
    // none), the earliest on a tie. The same map gives the same colour; to a reader it looks random
    function confettiHex(h) {
      var s = .55, l = .82, f = function (n) { var k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
      return '#' + [f(0), f(8), f(4)].map(function (v) { return ('0' + Math.round(v * 255).toString(16)).slice(-2); }).join('');
    }
    function confettiFill(text) { return confettiPick(confettiHues(text)); }   // the next confetti colour, #rrggbb, for the map's text (any format: #rrggbb, #rrggbbaa, CellDesigner's ARGB)
    function confettiHues(text) {   // the clearly coloured hues in a text
      var hues = [], re = /(?:#|color="[0-9a-fA-F]{2})([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?\b/g, m;
      while ((m = re.exec(String(text || '')))) {
        var r = parseInt(m[1].slice(0, 2), 16) / 255, g = parseInt(m[1].slice(2, 4), 16) / 255, b = parseInt(m[1].slice(4, 6), 16) / 255;
        var mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
        if (d <= .08) continue;
        var H = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        hues.push((H * 60 + 360) % 360);
      }
      return hues;
    }
    function confettiPick(hues) { return confettiHex(confettiHue(hues)); }   // a node's pastel, its hue added to hues
    // a line's colour of the same hues, darker and stronger so a thin line reads on white (HSL 70%, 42%: the colour test
    // maps' lines)
    function confettiLine(hues) {
      var h = confettiHue(hues), s = .7, l = .42, f = function (n) { var k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
      return '#' + [f(0), f(8), f(4)].map(function (v) { return ('0' + Math.round(v * 255).toString(16)).slice(-2); }).join('');
    }
    function confettiHue(hues) {   // the hue farthest from those given (the earliest on a tie), added to them
      var best = 0, far = -1;
      for (var k = 0; k < 64; k++) {
        var h = k * 137.508 % 360, near = hues.reduce(function (n, u) { var a = Math.abs(h - u) % 360; return Math.min(n, a, 360 - a); }, 360);
        if (near > far + 1e-9) { far = near; best = h; }
      }
      if (far < 1e-6) best = hues.length % 64 * 137.508 % 360;   // all 64 taken: round them again, so a large map is not one colour
      hues.push(best);
      return best;
    }
    var CONF;
    function __run16() {   // run at start, in order (__start)
    CONF = null;
    }
    function confettiOne(hex) {   // a colour (#rrggbb) one of Confetti's pastels
      if (!CONF) { CONF = {}; for (var k = 0; k < 64; k++) CONF[confettiHex(k * 137.508 % 360).toUpperCase()] = 1; }
      return !!hex && CONF[String(hex).slice(0, 7).toUpperCase()] === 1;
    }
    function confettiSquares() { return '<span class="m2-cs-sw">' + [0, 1, 2, 3, 4].map(function (k) { var x = confettiHex(k * 137.508 % 360); return '<i style="background:' + x + '" title="' + x.toUpperCase() + '"></i>'; }).join('') + '</span>'; }
    // Colours on SBGN-ML maps, kept per map or read from it (mapCols): the map's own (sbgn_edit.defaults: the fill most glyphs of the
    // kind have; the Default colours for a kind the map lacks), the viewer's Default colours, none, or Confetti
    var SB_COLS;
    function __run17() {   // run at start, in order (__start)
    SB_COLS = [['file', 'Original', 'The map\u2019s own colours, as they were before another choice; new glyphs in the colour most glyphs of their kind have on it'], ['default', 'Mist and sage', 'The whole map and new glyphs in the viewer\u2019s starting colours: a pale blue for proteins, a pale green for small molecules'], ['none', 'No colours', 'The whole map and new glyphs unfilled'], ['custom', 'Custom default', 'The whole map and new glyphs in the colours kept by Set as default; a kind with none as it is'], ['confetti', 'Confetti', 'Every glyph of the map, and every new one, a pastel of its own']];
    }
    function sbCols() { return mapCols(['file', 'none', 'default', 'confetti', 'custom'], sbIs); }
    var SB_SQ;
    function __run18() {   // run at start, in order (__start)
    SB_SQ = ['macromolecule', 'simple chemical', 'nucleic acid feature', 'phenotype', 'compartment'];
    }
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
    var SB_FILLED, sbActMemo;
    function __run19() {   // run at start, in order (__start)
    SB_FILLED = /^(macromolecule|simple chemical|nucleic acid feature|unspecified entity|perturbing agent|phenotype|complex|compartment|submap|biological activity|perturbation|tag|terminal)( multimer)?$/;
    sbActMemo = [null, {}];
    }
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
    function palFill() {   // the signs of the set chosen; the tabs and the look marked
      var k = palKey();
      var lang = palLangNow(), look = palLookNow();
      var pn = pal.querySelector('.m2-ed-pnot'); pn.hidden = false; pn.style.display = '';   // hidden on a CellDesigner map (cdFill)
      styleRow(); sbColsRow();   // the map's choices for new glyphs (pmap); a CellDesigner map shows the same rows with its own (cdFill)
      Array.prototype.forEach.call(pal.querySelectorAll('[data-lang]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
      Array.prototype.forEach.call(pal.querySelectorAll('[data-look]'), function (b) { b.setAttribute('aria-checked', String(b.dataset.look === look)); });
      pal.querySelector('.m2-ed-plook').hidden = !palViews();
      var hy = pal.querySelector('.m2-ed-pstrict'), hyc = hy.querySelector('input'), sg = pal.querySelector('.m2-ed-psbgn'), sgc = sg.querySelector('input');
      hy.hidden = sg.hidden = lang !== 'pd';
      cdInfo(hy, false);   // its SBGN texts back after a CellDesigner map
      if (sgc.checked !== sbgnStrict()) sgc.checked = sbgnStrict();
      var red = palSet.strict !== true;   // its own tick, kept while Strict SBGN takes it out of use
      if (hyc.checked !== red) hyc.checked = red;
      hyc.disabled = sbgnStrict(); hy.classList.toggle('m2-ed-poff', sbgnStrict());
      var pb = pal.querySelector('.m2-ed-pprot'), pbc = pb.querySelector('input');
      pb.hidden = !palViews();   // only on an Activity Flow map or an empty one (proteinBoxes leaves a map turned PD as it is)
      if (!pb.hidden) { var pf = protFile(); if (pf != null) protOn = pf; k = palKey(); }
      if (pbc.checked !== protOn) pbc.checked = protOn;
      var cc = pal.querySelector('.m2-ed-pcdc'), ccb = cc.querySelector('input'); cc.hidden = false;   // hidden on a CellDesigner map (cdFill)
      if (ccb.checked !== compat()) ccb.checked = compat();
      if (shared.palShown === k + compat()) return;
      shared.palShown = k + compat();
      if (tool && !palOk(tool.kind)) tool = null;   // a sign in hand that this set lacks (e.g. a delay kept after the map turned PD)
      palSignsEl.innerHTML = palSigns(palSet0(PALS[k])); palBlocks();
    }
    function palLook() {   // the map drawn in the SBGN view while AF's SBGN view is chosen and the map has no process (graphml.js afSbgn)
      var want = palOn() && palLookNow() === 'sbgn';
      if (want === shared.afSbgn) return;
      shared.afSbgn = want;
      if (on && V.current === map && !shared.cd) render();
    }
    function palPick(lang, look) {
      palSet = { lang: lang || palSet.lang, look: look || palSet.look, strict: palSet.strict, sbgn: palSet.sbgn };
      if (tool && !palOk(tool.kind)) tool = null;
      palKeep(); palFill(); palShow();   // palShow sets the look
    }
    function palOk(kind) { return palSet0(PALS[palKey()]).some(function (s) { return s[1].some(function (q) { return q[0] === kind; }); }); }
    var palMap;
    function __run20() {   // run at start, in order (__start)
    pal.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-lang], button[data-look]');
      if (b && !b.disabled) palDid([PAL_KEY], function () { palPick(b.dataset.lang, b.dataset.look); });
    });
    pal.querySelector('.m2-ed-pstrict input').addEventListener('change', function (e) { e.target.blur(); if (cdPal()) return; palDid([PAL_KEY], function () { palSet.strict = !e.target.checked; palKeep(); }); });   // a CellDesigner map's own: cdcreate.js   // blurred: the editor's keys (undo) work at once
    pal.querySelector('.m2-ed-psbgn input').addEventListener('change', function (e) { e.target.blur(); if (cdPal()) return; palDid([PAL_KEY], function () { palSet.sbgn = e.target.checked; palKeep(); palFill(); }); });   // blurred: the editor's keys (undo) work at once
    pal.querySelector('.m2-ed-pcdc input').addEventListener('change', function (e) {
      var v = e.target.checked; e.target.blur();   // the editor's keys (undo) work at once
      palDid([CDC_KEY], function () { try { if (v) localStorage.setItem(CDC_KEY, 'on'); else localStorage.removeItem(CDC_KEY); } catch (er) {} });
      if (tool && !palOk(tool.kind)) tool = null;   // a tag in hand
      shared.palShown = null; palShow(); paint();
    });
    pal.querySelector('.m2-ed-pprot input').addEventListener('change', function (e) {   // every protein activity given the box or not, one undo step
      protOn = e.target.checked; e.target.blur();   // the editor's keys (undo) work at once, not the tick box's
      var t2 = palOn() ? sbJs.proteinBoxes(shared.text, protOn) : shared.text;
      commit(t2, { name: 'protein boxes' });
      palShow(); paint();
    });
    palMap = null;
    }
    // the palette's choices kept in this browser (its set, Strict, Style, Set as default) undone as settings (V.lsDid):
    // the map's own entry put back (KEY#id), the others' left as they are, then read again here for the map open
    function palAgain() { palMap = null; shared.cdStrictMemo = [null, false]; choiceMemo = {}; if (on) { palSync(); shared.palShown = null; palShow(); paint(); } }
    function palDid(keys, act) { var id = palId(), was = V.lsSnap(keys.map(function (k) { return k === PAL_KEY || k === CHOICE_KEY ? (id ? k + '#' + id : k) : k; })); act(); V.lsDid(was, palAgain); }
    function palSync() { var id = palId(); if (id !== palMap) { palMap = id; palSet = palFor(); protOn = protFile() === true; shared.palShown = null; palFill(); } }   // only when the map changes (palShow runs on every paint)
    function __run21() {   // run at start, in order (__start)
    box.querySelector('.m2-ed-tools').insertAdjacentElement('afterend', pal);
    }
    function palOn() { return on && V.current === map && !!shared.sb && !!sbJs && V.level === 'full'; }
    function palShow() {
      var cdp_ = cdPal(), show = palOn() || cdp_;   // a CellDesigner map: its own set (cdcreate.js)
      if (cdp_) cdFill();
      else if (show) { palSync(); palFill(); }   // palFill: a process added or removed turns the SBGN view off or on
      pal.hidden = !show;
      pmap.hidden = !show || !!(shared.selN.length || shared.selE.length || shared.selP.length || shared.svSel);   // only while nothing is selected
      if (pmap.hidden) ddClose();
      if (!show) tool = null;
      Array.prototype.forEach.call(pal.querySelectorAll('button[data-make]'), function (b) {
        var mine = !!tool && tool.kind === b.dataset.make;
        b.setAttribute('aria-pressed', String(mine));
        b.classList.toggle('m2-ed-sticky', mine && tool.sticky);
      });
      if (!tool && V.view.style.cursor === 'default') V.view.style.cursor = '';
      if (props) propsShow();   // Properties (below), as the selection or Settings change
      palLook();
    }
    function palTake(kind, sticky) { tool = kind ? { kind: kind, sticky: !!sticky } : null; shared.cdGate = null; palShow(); }   // a CellDesigner gate's clicks begun start again
    var placeAt, placedAt;
    function __run22() {   // run at start, in order (__start)
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
    placeAt = null, placedAt = 0;
    }   // placedAt: when something was last put on the map (a double click there is not a second request)
    function palDown(e) {
      if (!tool || arcTool() || !(palOn() || cdPal())) return false;   // an arc's sign: the drag from a node draws it (linkDown)
      placeAt = { x: e.clientX, y: e.clientY, P: at(e) };
      return true;
    }
    function palUp(e) {
      var p = placeAt; placeAt = null;
      if (!p || e.type !== 'pointerup' || Math.hypot(e.clientX - p.x, e.clientY - p.y) >= 5) return false;
      e.stopImmediatePropagation();   // not the viewer's click (it would open an annotation)
      if (!tool) return true;   // let go between the press and the release (Esc)
      placedAt = Date.now();
      if (cdPal()) { cdClick(p.P); if (tool && !tool.sticky && !CD_GATE[tool.kind]) palTake(null); return true; }   // a gate lets go once made (cdGateClick)
      makeEntity(p.P, tool.kind);
      if (tool && !tool.sticky) palTake(null);
      return true;
    }
    function freeId(base, taken) {   // an id neither file has (nor taken: ids given in the same step)
      var s = src(), i = 1;
      var del = sbJs.gone(shared.text), used = function (q) { return shared.text.indexOf('"' + q + '"') >= 0 || s.indexOf('"' + q + '"') >= 0 || s.indexOf("'" + q + "'") >= 0 || del.indexOf(q) >= 0 || (taken || []).indexOf(q) >= 0; };   // an id deleted earlier is not used again (a draft reopened on an older build would join them)
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
    // a glyph dropped on a complex becomes its member, as soon as it is dropped on the complex's surface (a smaller
    // complex on a larger one too), as a glyph dropped in a compartment joins it: each glyph moved (not one inside another
    // moved, nor one in a complex already) whose centre lies on a complex not moving with it joins the innermost such
    // complex, in the move's undo step, and the complex is packed (Pack: the members side by side, the complex and what
    // holds it grown); a glyph made from the palette on a complex the same. SBGN-ML maps (not Activity Flow) with
    // sbgn_edit.join, CellDesigner maps with cd_make.join; Full editing only. A glyph with lines is not taken in (a line
    // goes to a complex, never to a member): the whole move is taken back, nothing said (joinPlan's why).
    // joinPlan(moved, leaving) -> { joins: [[id, complex id], ...], why }   moved: the ids the move moved, or the one made;
    // leaving: the ids whose holder the move changes (a member taken out with Shift may land on another complex)
    function joinWhy(code, name) {
      return { lines: name + ' has lines, so it stays where it was: a line goes to a complex, never to its member.',
        copies: name + ' is drawn more than once, so it stays where it was: a complex member is drawn once.' }[code] || '';
    }
    function joinPlan(moved, leaving) {
      var out = { joins: [], why: '' };
      if (!on || V.current !== map || V.level !== 'full' || !moved.length || (shared.cd ? !cdMk || !cdMk.join : !palOn() || !sbJs.join || palKind() === 'af' || shared.afSbgn)) return out;
      var at = {}, cx = [], mv0 = {};
      nodes2.forEach(function (n, i) { at[n.id] = i; if (n.shape.kind === 'Complex') cx.push(i); });
      moved.forEach(function (id) { mv0[id] = 1; });
      var out0 = {}; (leaving || []).forEach(function (id) { out0[id] = 1; });
      var inCx = function (i) { for (var u = nodes2[i].up; u != null; u = nodes2[u].up) if (nodes2[u].shape.kind === 'Complex') return true; return false; };
      moved.forEach(function (id) {
        var i = at[id];
        if (i == null || out.why || (shared.cd && cdOwn(i)) || (nodes2[i].up != null && mv0[nodes2[nodes2[i].up].id]) || (!out0[id] && inCx(i))) return;
        var b = boxOf(i), P = [b[0] + b[2] / 2, b[1] + b[3] / 2], best = -1, area = Infinity;
        cx.forEach(function (j) {   // the innermost complex round its centre that does not move with it
          var q = boxOf(j);
          if (mv0[nodes2[j].id] || P[0] < q[0] || P[1] < q[1] || P[0] > q[0] + q[2] || P[1] > q[1] + q[3] || q[2] * q[3] >= area) return;
          for (var u = nodes2[j].up; u != null; u = nodes2[u].up) if (mv0[nodes2[u].id]) return;
          best = j; area = q[2] * q[3];
        });
        if (best < 0) return;
        var why;
        try { why = shared.cd ? cdMk.joinable(shared.cd.now, id, nodes2[best].id) : sbJs.joinable(shared.text, id, nodes2[best].id); } catch (err) { return; }
        if (!why) out.joins.push([id, nodes2[best].id]);
        else out.why = joinWhy(why, '"' + (nameOf(i) || id) + '"');
      });
      return out;
    }
    // the joins of joinPlan written (SBGN-ML: into the editor's GraphML; CellDesigner: into the file, the GraphML made again
    // from it), the selection kept; returns the ids of the complexes that took a member
    // a glyph joining a complex where it would lie on a member is put first under the members, its left side on theirs
    // (Pack keeps members where they are and would leave the two on top of each other), with what it holds
    function joinBeside(id, cid) {
      var at = {}; nodes2.forEach(function (n, k) { at[n.id] = k; });
      var i = at[id], c = at[cid];
      if (i == null || c == null) return;
      var b = boxOf(i), ms = nodes2.map(function (n, k) { return k; }).filter(function (k) { return nodes2[k].up === c && k !== i; });
      if (!ms.some(function (k) { return overlap(boxOf(k), b); })) return;
      var u = ms.map(boxOf).reduce(function (a, q) { return [Math.min(a[0], q[0]), Math.max(a[1], q[1] + q[3])]; }, [Infinity, -Infinity]), dx = u[0] - b[0], dy = u[1] + 4 - b[1], nb = {};
      nodes2.forEach(function (n, k) { if (k === i || under(k, i)) { var q = boxOf(k); nb[k] = [q[0] + dx, q[1] + dy, q[2], q[3]]; } });
      setBoxes(nb);
    }
    function joinDo(joins) {
      if (!joins.length) return [];
      joins.forEach(function (q) { joinBeside(q[0], q[1]); });
      var sel = shared.selN.map(function (i) { return nodes2[i].id; }), done = [];
      if (shared.cd) {
        var N = cdNow(), t = N.t;
        joins.forEach(function (q) { try { t = cdMk.join(t, q[0], q[1]); done.push(q[1]); } catch (err) { warn(String(err && err.message || err)); } });
        if (done.length) cdRebuild(t, N.sh);
      } else joins.forEach(function (q) { try { setText(sbJs.join(shared.text, q[0], q[1], { checked: true })); done.push(q[1]); } catch (err) { warn('A glyph could not be put into the complex.'); } });
      if (!done.length) return done;
      parse(); shared.dirty = true;
      var at = {}; nodes2.forEach(function (n, i) { at[n.id] = i; });
      shared.selN = sel.filter(function (id) { return at[id] != null; }).map(function (id) { return at[id]; });
      return done;
    }
    // the complexes that took a member packed, in the same undo step (Pack's own code, layTool)
    function joinPack(cids) { if (cids.length) layTool('pack', cids, true); }
    // a submap's terminals: tags on its border (yEd's Tag, a top-level node as the submap: neither holds the other), each
    // moving with its submap as what a group holds (inside); sub: the submap a tag belongs to. A tag the file calls a
    // terminal (node property SBGN class) touching a submap, or one inside a submap's box meeting one of its sides (a yEd
    // file, the converter's rule); the nearest submap
    // (core.js parseFix); the converter's graphml.terminals is the master of the rule
    function terminals() {
      var subs = [], key = null;
      nodes2.forEach(function (n, i) { n.sub = null; if (n.shape.kind === 'Submap') subs.push(i); });
      if (!subs.length) return;
      Array.prototype.forEach.call(doc.getElementsByTagNameNS(G, 'key'), function (k) { if (k.getAttribute('attr.name') === 'SBGN class' && k.getAttribute('for') === 'node') key = k.getAttribute('id'); });
      nodes2.forEach(function (n, i) {
        if (n.shape.kind !== 'Tag') return;
        var d = key && Array.prototype.filter.call(n.el.childNodes, function (c) { return c.localName === 'data' && c.getAttribute('key') === key; })[0];
        var marked = !!d && d.textContent.trim() === 'terminal', b = boxOf(i), best = -1, bd = Infinity;
        subs.forEach(function (j) {
          var q = boxOf(j), touch = b[0] <= q[0] + q[2] + 1 && q[0] <= b[0] + b[2] + 1 && b[1] <= q[1] + q[3] + 1 && q[1] <= b[1] + b[3] + 1;
          var side = q[0] - 1 <= b[0] && b[0] + b[2] <= q[0] + q[2] + 1 && q[1] - 1 <= b[1] && b[1] + b[3] <= q[1] + q[3] + 1 &&
            Math.min(Math.abs(b[0] - q[0]), Math.abs(b[0] + b[2] - q[0] - q[2]), Math.abs(b[1] - q[1]), Math.abs(b[1] + b[3] - q[1] - q[3])) <= 1;
          if (!(marked ? touch : side)) return;
          var dd = Math.hypot(b[0] + b[2] / 2 - q[0] - q[2] / 2, b[1] + b[3] / 2 - q[1] - q[3] / 2);
          if (dd < bd) { bd = dd; best = j; }
        });
        if (best >= 0) { n.sub = best; nodes2[best].inside.push(i); }
      });
    }
    function __run23() {   // run at start, in order (__start)
    parseFix.push(terminals);
    }
    // a submap's terminal: its flat back on its border, sliding along it (as units of information along a glyph), its point
    // into the submap (SBGN PD's examples), so its way is away from the side it is on, long across the side (a tag's two sizes swapped
    // between a left or right side and the top or bottom). subAt: the submap P lies in, or whose border passes within d of it
    function subAt(P, d) {
      var best = -1, bd = Infinity;
      nodes2.forEach(function (n, j) {
        if (n.shape.kind !== 'Submap') return;
        var q = boxOf(j), ins = P[0] >= q[0] && P[0] <= q[0] + q[2] && P[1] >= q[1] && P[1] <= q[1] + q[3];
        var e = ins ? 0 : Math.hypot(Math.max(q[0] - P[0], 0, P[0] - q[0] - q[2]), Math.max(q[1] - P[1], 0, P[1] - q[1] - q[3]));
        if (e <= d && (e < bd || (e === bd && best >= 0 && q[2] * q[3] < boxOf(best)[2] * boxOf(best)[3]))) { bd = e; best = j; }   // inside several: the innermost
      });
      return best;
    }
    function onBorder(b, q) {   // [its box on submap q's nearest side, inside and touching it, its way]
      var c = [b[0] + b[2] / 2, b[1] + b[3] / 2], L = Math.max(b[2], b[3]), S = Math.min(b[2], b[3]);
      var oy = Math.max(q[1] - c[1], 0, c[1] - q[1] - q[3]), ox = Math.max(q[0] - c[0], 0, c[0] - q[0] - q[2]);   // the side nearest its centre, as a segment
      var d = [Math.hypot(c[0] - q[0], oy), Math.hypot(q[0] + q[2] - c[0], oy), Math.hypot(ox, c[1] - q[1]), Math.hypot(ox, q[1] + q[3] - c[1])], k = d.indexOf(Math.min.apply(null, d));
      var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(v, Math.max(lo, hi))); };
      if (k < 2) { var y = clamp(c[1] - S / 2, q[1], q[1] + q[3] - S); return [[k ? q[0] + q[2] - L : q[0], y, L, S], k ? 'left' : 'right']; }
      var x = clamp(c[0] - S / 2, q[0], q[0] + q[2] - S);
      return [[x, k === 3 ? q[1] + q[3] - L : q[1], S, L], k === 3 ? 'up' : 'down'];
    }
    // a terminal already on the side its way says (its back on that side, within the submap along it): kept there, slid back
    // inside along the side if the submap shrank, else null. At a corner its centre is nearer the other side, which onBorder
    // would take (a submap resized, a terminal moved by the keys to the end of a side)
    var SIDE;
    function __run24() {   // run at start, in order (__start)
    SIDE = { right: 0, left: 1, down: 2, up: 3 };
    }   // the side a way points away from: left, right, top, bottom
    function onSide(b, q, way, any) {   // any: kept on that side wherever it is (a submap resized moves its sides from it)
      var k = SIDE[way], L = Math.max(b[2], b[3]), S = Math.min(b[2], b[3]), e = 0.5;
      if (k == null) return null;
      var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(v, Math.max(lo, hi))); };
      if (k < 2) {
        var x = k ? q[0] + q[2] - L : q[0];
        if (!any && (Math.abs(b[0] - x) > e || b[2] !== L || b[1] < q[1] - e || b[1] + b[3] > q[1] + q[3] + e)) return null;
        return [[x, clamp(b[1], q[1], q[1] + q[3] - S), L, S], way];
      }
      var y = k === 3 ? q[1] + q[3] - L : q[1];
      if (!any && (Math.abs(b[1] - y) > e || b[3] !== L || b[0] < q[0] - e || b[0] + b[2] > q[0] + q[2] + e)) return null;
      return [[clamp(b[0], q[0], q[0] + q[2] - S), y, S, L], way];
    }
    // the arrow keys move a submap's terminal (selected alone) round its submap's border, as a state variable round its
    // node: by 1 unit, with Shift by 10, its centre along a track that keeps it whole on each side, turning at the corners
    // to the next side; the key's direction along the side as keyDir, a key held keeping its first direction round the
    // corners. Written at each step (one undo step for a run, as the keys' moves)
    var tKey, HORIZ;
    function __run25() {   // run at start, in order (__start)
    tKey = null;
    keyTake.push(function (d, e) {
      if (!sbJs || !sbJs.way || shared.selN.length !== 1 || shared.selP.length) return false;
      var i = shared.selN[0], n = nodes2[i];
      if (!n || n.shape.kind !== 'Tag' || n.sub == null || shared.selE.some(function (k) { return edges2[k].s !== i && edges2[k].t !== i; })) return false;   // alone, or with its own lines
      var b = boxOf(i), q = boxOf(n.sub), L = Math.max(b[2], b[3]), S = Math.min(b[2], b[3]);
      var R = [q[0] + S / 2, q[1] + S / 2, Math.max(q[2] - S, 0), Math.max(q[3] - S, 0)], w = R[2], h = R[3], P = 2 * (w + h);
      if (!P) return true;   // a submap no bigger than the tag: no room to move along (a side shorter than the tag: one place on it)
      var way = (sbJs.wayOfR && sbJs.wayOfR(realizerOf(n.el))) || onBorder(b, q)[1];
      var cx = Math.max(R[0], Math.min(b[0] + b[2] / 2, R[0] + w)), cy = Math.max(R[1], Math.min(b[1] + b[3] / 2, R[1] + h));
      var t = { down: cx - R[0], left: w + cy - R[1], up: w + h + R[0] + w - cx, right: 2 * w + h + R[1] + h - cy }[way];   // its place on the track, clockwise from the top left
      if (t == null) return false;
      if (!tKey || tKey.id !== n.id || tKey.key !== e.key || !e.repeat) tKey = { id: n.id, key: e.key, dir: keyDir([0, 0, w, h], t, [Math.sign(d[0]), Math.sign(d[1])]) };
      t = (((t + tKey.dir * Math.max(Math.abs(d[0]), Math.abs(d[1]))) % P) + P) % P;
      var nb, nw;
      if (t < w) { nw = 'down'; nb = [R[0] + t - S / 2, q[1], S, L]; }
      else if (t < w + h) { nw = 'left'; nb = [q[0] + q[2] - L, R[1] + t - w - S / 2, L, S]; }
      else if (t < 2 * w + h) { nw = 'up'; nb = [R[0] + w - (t - w - h) - S / 2, q[1] + q[3] - L, S, L]; }
      else { nw = 'right'; nb = [q[0], R[1] + h - (t - 2 * w - h) - S / 2, L, S]; }
      var o = {}; o[i] = nb.map(function (v) { return +fmt(v); });
      var eids = shared.selE.map(function (k) { return edges2[k] && edges2[k].id; });   // by id: the map is read again
      commit(null, { name: 'tag turned', ids: [tKey.id], merge: true, write: function () { setBoxes(o); }, parsed: true, then: function () {
        var at = -1; nodes2.forEach(function (m, k) { if (m.id === tKey.id) at = k; });
        if (at >= 0) { var t2 = tagTurnT(shared.text, at, nw, true); if (t2 !== shared.text) { setText(t2); parse(); } }
        shared.selN = at >= 0 ? [at] : []; shared.selE = edges2.map(function (q, k) { return eids.indexOf(q.id) >= 0 ? k : -1; }).filter(function (k) { return k >= 0; });
      } });
      return true;
    });
    // a tag turned spins as a whole (its width and height swapped round its centre between left or right and up or down;
    // placed: its box already set, as onBorder gives it), and its lines end at its two ports, its point and the middle of its
    // flat back: a free tag's one line at its point, which faces the line's other end by itself (tagAim); a terminal's line
    // from outside its submap at its back (on the border), one from inside at its point. Text in, text out, for node i as the map is read now
    HORIZ = { left: 1, right: 1 };
    }
    function tagTurnT(t, i, way, placed) {
      var n = nodes2[i], id = n.id, b = boxOf(i), now = (sbJs.wayOfR && sbJs.wayOfR(realizerOf(n.el))) || 'right', nb = b;
      if (!placed && (HORIZ[way] ? b[3] > b[2] : b[2] > b[3])) nb = [b[0] + b[2] / 2 - b[3] / 2, b[1] + b[3] / 2 - b[2] / 2, b[3], b[2]].map(function (v) { return +fmt(v); });   // long across its point's direction
      if (nb !== b) t = sbJs.resize(t, id, nb);
      if (way !== now) t = sbJs.way(t, id, way);
      var q = n.sub != null ? boxOf(n.sub) : null, es = edges2.filter(function (e) { return e.s === i || e.t === i; });
      if (!q && es.length !== 1) return t;
      es.forEach(function (e) {
        var end = e.t === i, o = boxOf(end ? e.s : e.t), p = tagEnd(way, nb, q, [o[0] + o[2] / 2, o[1] + o[3] / 2]);
        t = GE.pathOf(t, e.id, [[end ? 'tx' : 'sx', p[0]], [end ? 'ty' : 'sy', p[1]]].map(function (k) { return [k[0], sbJs.repr(k[1])]; }));   // its Path in this edge only; a missing offset added
      });
      return t;
    }
    // a line's port on a tag of box b turned way, as an offset from its centre: at its point for a free tag (q null) and
    // for a terminal's line from inside its submap q (oc: the centre of the line's other end), at its back from outside.
    // The one rule for the drop (tagTurnT) and the drag (livePose below)
    function tagEnd(way, b, q, oc) {
      var tip = { right: [b[2] / 2, 0], left: [-b[2] / 2, 0], down: [0, b[3] / 2], up: [0, -b[3] / 2] }[way];
      return !q || (oc[0] > q[0] && oc[0] < q[0] + q[2] && oc[1] > q[1] && oc[1] < q[1] + q[3]) ? tip : [-tip[0], -tip[1]];
    }
    function tagAim(ids) {   // the free tags among ids with one line: each turned to face the line's other end
      var t2 = shared.text;
      nodes2.forEach(function (n, i) {
        if (ids.indexOf(n.id) < 0 || n.shape.kind !== 'Tag' || n.sub != null) return;
        var es = edges2.filter(function (q) { return q.s === i || q.t === i; });
        if (es.length !== 1) return;
        var o = es[0].s === i ? es[0].t : es[0].s, b = boxOf(i), q = boxOf(o), dx = q[0] + q[2] / 2 - b[0] - b[2] / 2, dy = q[1] + q[3] / 2 - b[1] - b[3] / 2;
        t2 = tagTurnT(t2, i, Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up'));
      });
      if (t2 !== shared.text) { setText(t2); parse(); shared.dirty = true; }
    }
    // after a move (core.js fixMoved) or a submap resized: each terminal back onto its submap's border, its way by its side
    function termsFix(list, any) {   // any: each kept on the side it is on (onSide)
      if (!sbJs || !sbJs.way) return;
      var nb = {}, ways = [];
      list.forEach(function (i) {
        var s = nodes2[i] && nodes2[i].sub;
        if (s == null) return;
        var b = boxOf(i), q = boxOf(s), on = onSide(b, q, (sbJs.wayOfR && sbJs.wayOfR(realizerOf(nodes2[i].el))) || '', any) || onBorder(b, q);
        if (on[0].some(function (v, j) { return Math.abs(v - b[j]) > 0.001; })) nb[i] = on[0];
        ways.push([nodes2[i].id, on[1]]);
      });
      if (Object.keys(nb).length) setBoxes(nb);
      var t2 = shared.text, at = {};
      nodes2.forEach(function (n, k) { at[n.id] = k; });
      ways.forEach(function (q) { t2 = tagTurnT(t2, at[q[0]], q[1], true); });   // its lines at its ports (its box set above)
      if (t2 !== shared.text) { setText(t2); parse(); shared.dirty = true; }
    }
    // a tag moved: a terminal moved without its submap slides along it, and with Shift (alone) dropped with its centre out
    // of the submap it leaves it, a free tag again; a free tag dropped with its centre inside a submap joins it (as a
    // glyph joins a compartment), its terminal from then on. Shift keeps a free tag free
    var TURN;
    function __run26() {   // run at start, in order (__start)
    moveFix.push(function (set, alone) {
      if (!sbJs || !sbJs.terminal) return;
      var ids = new Set(), keep = new Set(), out = [], join = [];
      set.forEach(function (i) { ids.add(nodes2[i].id); });   // by id: terminal() reorders the nodes
      set.forEach(function (i) {
        var n = nodes2[i];
        if (n.shape.kind !== 'Tag') return;
        if (n.sub != null) {
          if (set.has(n.sub)) return;
          if (alone && !centreIn(boxOf(i), boxOf(n.sub))) {   // taken out with Shift: a free tag has one line
            if (linesAt(i) <= 1) { out.push(n.id); return; }
            warn('A free tag has one line: take one of this terminal\u2019s two lines off first.');
          }
          keep.add(n.id); return;
        }
        if (alone) return;
        var j = subIn(boxOf(i), set);
        if (j >= 0) join.push([i, j]);
      });
      var nb = {};
      join.forEach(function (q) { nb[q[0]] = onBorder(boxOf(q[0]), boxOf(q[1]))[0]; keep.add(nodes2[q[0]].id); });   // onto its side first, so it is the submap's it touches
      if (join.length) setBoxes(nb);
      var t2 = shared.text;
      out.forEach(function (id) { t2 = sbJs.terminal(t2, id, false); });
      join.forEach(function (q) { t2 = sbJs.terminal(t2, nodes2[q[0]].id, true); });
      if (t2 !== shared.text) { setText(t2); parse(); shared.dirty = true; }
      termsFix(nodes2.map(function (m, k) { return keep.has(m.id) ? k : -1; }).filter(function (k) { return k >= 0; }));
      var aim = [];   // the free tags moved, and those whose line's other end moved
      edges2.forEach(function (q) { if (q.s != null && q.t != null) [[q.s, q.t], [q.t, q.s]].forEach(function (p) { if (nodes2[p[0]].shape.kind === 'Tag' && (ids.has(nodes2[p[0]].id) || ids.has(nodes2[p[1]].id))) aim.push(nodes2[p[0]].id); }); });
      tagAim(aim);
    });
    // the same during the drag (live.js livePose): each tag shown where the release puts it, by the rules above: a terminal
    // held on its submap's border, sliding along it and turning at its corners (with Shift and its centre out of the
    // submap, with one line, free); a free tag dragged with its centre into a submap on its border; a free tag with one
    // line facing the line's other end
    TURN = { right: 0, down: 90, left: 180, up: 270 };
    livePose.push(function (sets, alone, out) {
      if (!sbJs || !sbJs.terminal) return;
      // a line's other end where the drop has it: posed in the first pass (a terminal on its border), else moved by the drag
      var raw = function (k) { var b = boxOf(k); return sets.n.has(k) ? [b[0] + sets.dx, b[1] + sets.dy, b[2], b[3]] : b; };
      var moved = function (k) { return out[k] ? out[k].box : raw(k); };
      var mid = function (b) { return [b[0] + b[2] / 2, b[1] + b[3] / 2]; };
      var lines = null, linesOf = function (i) {   // the tags' lines, gathered once per frame
        if (!lines) { lines = {}; edges2.forEach(function (q, k) { if (q.s != null && q.t != null) [q.s, q.t].forEach(function (x) { if (nodes2[x].shape.kind === 'Tag') (lines[x] = lines[x] || []).push(k); }); }); }
        return lines[i] || [];
      };
      // two passes, as the drop: the terminals onto their borders first (termsFix), then the free tags facing their line's
      // other end where it now is (tagAim), the terminals' ports from the posed ends too
      [0, 1].forEach(function () { nodes2.forEach(function (n, i) {
        if (n.shape.kind !== 'Tag' || (n.sub != null && sets.n.has(n.sub))) return;   // a terminal going with its submap
        var mine = sets.n.has(i);
        if (!mine && n.sub != null) return;
        var es = linesOf(i);
        if (!mine && !(es.length === 1 && (out[edges2[es[0]].s === i ? edges2[es[0]].t : edges2[es[0]].s] || sets.n.has(edges2[es[0]].s === i ? edges2[es[0]].t : edges2[es[0]].s)))) return;   // nothing it does follows this move
        var mb = raw(i), on = null, q = null, now = (sbJs.wayOfR && sbJs.wayOfR(realizerOf(n.el))) || 'right';
        if (mine && n.sub != null) { if (!(alone && !centreIn(mb, boxOf(n.sub)) && es.length <= 1)) q = boxOf(n.sub); }
        else if (mine && !alone) { var j = subIn(mb, sets.n); if (j >= 0) q = boxOf(j); }
        if (q) on = (n.sub != null && onSide(mb, q, now)) || onBorder(mb, q);   // as termsFix on release
        else {   // free, facing its one line's other end (tagAim)
          if (es.length !== 1) return;
          var e = edges2[es[0]], oc = mid(moved(e.s === i ? e.t : e.s)), c = mid(mb), dx = oc[0] - c[0], dy = oc[1] - c[1];
          var way = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up');
          on = [!!HORIZ[way] === (mb[2] >= mb[3]) ? mb : [c[0] - mb[3] / 2, c[1] - mb[2] / 2, mb[3], mb[2]], way];   // as tagTurnT: long across its point's direction
        }
        var ports = {};
        es.forEach(function (k) { var e = edges2[k]; ports[k] = tagEnd(on[1], on[0], q, mid(moved(e.s === i ? e.t : e.s))); });   // as tagTurnT sets them
        out[i] = { box: on[0], way: on[1], turn: (TURN[on[1]] - TURN[now] + 360) % 360, ports: ports };
      }); });
    });
    }
    function centreIn(b, q) { var c = [b[0] + b[2] / 2, b[1] + b[3] / 2]; return c[0] >= q[0] && c[0] <= q[0] + q[2] && c[1] >= q[1] && c[1] <= q[1] + q[3]; }
    function subIn(b, not) {   // the innermost submap holding b's centre (not one of the set `not`), else -1
      var j = -1, a = Infinity;
      nodes2.forEach(function (m, k) { var q = boxOf(k); if (m.shape.kind === 'Submap' && !(not && not.has(k)) && centreIn(b, q) && q[2] * q[3] < a) { a = q[2] * q[3]; j = k; } });
      return j;
    }
    function linesAt(i) { return edges2.filter(function (q) { return q.s === i || q.t === i; }).length; }
    // a line taking a tag's port (drawn, or an end dragged onto it): a free tag one, a terminal one from outside its
    // submap and one from inside; a reason, or null. o: the line's other end, k: a line not counted (the one moved)
    function tagRoom(tg, o, k) {
      var n = nodes2[tg], es = edges2.filter(function (q, j) { return j !== k && (q.s === tg || q.t === tg); });
      if (n.sub == null) return es.length ? 'A tag has one line, and this one has it.' : null;
      var q = boxOf(n.sub), side = function (x) { return centreIn(boxOf(x), q); }, mine = side(o);
      return es.some(function (e) { return side(e.s === tg ? e.t : e.s) === mine; }) ? 'A terminal has one line from outside its submap, at its back, and one from inside, at its point; this one is taken.' : null;
    }
    function makeEntity(P, cls) {
      var units = PRESET[cls] ? PRESET[cls][1] : null; cls = baseKind(cls);
      var act = ACT_UNIT[cls], D = defOf(cls), w = D.w, h = D.h, X = P[0] - w / 2, Y2 = P[1] - h / 2;   // act: an activity's unit
      if (gridSet.snap) { X += toGrid(X + w / 2, gridSet.step); Y2 += toGrid(Y2 + h / 2, gridSet.step); }   // its centre on the grid, as a drag puts it
      var bx0 = [+fmt(X), +fmt(Y2), w, h], c = holder(bx0, function () { return false; }, boxOf), id = freeId('glyph_'), onCx = innermost(P, function (n) { return n.shape.kind === 'Complex'; }) >= 0;   // c: the innermost compartment holding its box
      var t2, way = null, sm = cls === 'tag' ? subAt(P, Math.max(w, h) / 2) : -1;
      if (cls === 'tag') { var on = sm >= 0 ? onBorder([X, Y2, w, h], boxOf(sm)) : null; way = on ? on[1] : 'right'; if (!on && bx0[3] > bx0[2]) bx0 = [+fmt(P[0] - h / 2), +fmt(P[1] - w / 2), h, w]; if (on) { bx0 = on[0].map(function (v) { return +fmt(v); }); c = nodes2[sm].up; } }   // its box onto the submap's side, pointing in, held where its submap is
      try { t2 = sbJs.add(shared.text, { id: id, cls: act != null ? sbJs.unitClass(act) : cls, activity: act, label: '', box: bx0, parent: c != null ? nodes2[c].id : null, fill: D.fill, line: D.line, width: D.width, multimer: D.multimer, font: D.font, units: units || undefined, way: way, letters: sbJs.GLT.test(cls) ? stdLetters() : null }); if (sm >= 0) t2 = sbJs.terminal(t2, id, true); }
      catch (err) { warn('The ' + (act != null ? 'activity' : cls) + ' could not be added: ' + (err && err.message || err) + '.'); return; }
      remember(false); setText(t2);
      if (cls === 'compartment') {   // what it covers taken in, in the same undo step
        parse();
        var ni = nodes2.findIndex(function (n) { return n.id === id; }), inn = ni >= 0 ? regroup('box', new Set([ni]), boxOf, function (k) { return k === ni ? [0, 0, 0, 0] : boxOf(k); }) : new Map();
        return settle(inn, { moving: [id] }, function () { made(id); }, function () { made(id); });   // also stacked among the compartments it partly overlaps
      }
      if (!onCx) { made(id); return; }
      parse();
      var cids = joinDo(joinPlan([id]).joins);   // made on a complex: its member, the complex packed round it
      made(id); joinPack(cids);
    }
    // the kinds of glyph the palette makes, and Delete removes (the map's own ones too)
    // the kinds made: sbgn_edit's MAKE (the master), but the compartment, resized and deleted its own way
    function isMade(n) { var K = sbJs && sbJs.MAKE; return !!K && n.shape.kind !== 'Compartment' && Object.keys(K).some(function (c) { return K[c] === n.shape.kind; }) && n.el.getAttribute('yfiles.foldertype') !== 'group'; }
    function emptyComp(n) { return !!n.comp && !nodes2.some(function (m) { return m.up != null && nodes2[m.up] === n; }); }   // a compartment with nothing in it: deleted like the others
    function madeAt(P) { return innermost(P, isMade); }
    // the macromolecule under P, only when it is the innermost such glyph there: a simple chemical lying over a protein
    // takes the right click (else Add state variable would go to the protein under it)
    function macroAt(P) { var i = madeAt(P); return i >= 0 && nodes2[i].shape.kind === 'Macromolecule' ? i : -1; }
    // the places a state variable sits on its node's border, as [rx, ry], as ports:
    // the corners, each side's middle and the points between them; never marked, a drag always lands on the nearest.
    // new ones fill them by svPlaces (worked out from the node's size, below)
    // a drag lands on the nearest of more places: each side cut in eighths,
    // so the corners, the middles, the quarters and the points between; the arrow keys move it by single units (below)
    var PLACES;
    function __run27() {   // run at start, in order (__start)
    PLACES = (function () { var out = [], k; for (k = -4; k <= 4; k++) { out.push([k / 8, -0.5], [k / 8, 0.5]); if (Math.abs(k) < 4) out.push([-0.5, k / 8], [0.5, k / 8]); } return out; })();
    }
    function border(i, P) {   // the place nearest P
      var b = svBox(i), best = null, d0 = Infinity;
      PLACES.forEach(function (q) { var d = Math.hypot(b[0] + (0.5 + q[0]) * b[2] - P[0], b[1] + (0.5 + q[1]) * b[3] - P[1]); if (d < d0) { d0 = d; best = q; } });
      return best.slice();
    }
    // the right-click menu over a macromolecule (not over its state variables or units): Add state variable, Add unit of
    // information, Make multimer or Make macromolecule (SBGN's names, macromolecule and macromolecule
    // multimer); [label, action] pairs
    var NAME_WORDS;
    function __run28() {   // run at start, in order (__start)
    NAME_WORDS = { tl: 'Name at top left', t: 'Name at top middle', tr: 'Name at top right', bl: 'Name at bottom left', b: 'Name at bottom middle', br: 'Name at bottom right' };
    // Select all of this kind, at the end of the right-click menu over a node: every node of the map of its kind selected
    // (SBGN-ML: its class, a multimer with its plain kind; CellDesigner: its species class, or compartment; GraphML: its
    // shape), so Properties sets them together
    ownMenus.push(function (P) { return (shared.sb || cdPal()) && svAt(P); });   // a state variable or unit of information: its own menu only
    window.m2EditNodeItems = function () {
      var it = nodeItems(), h = rclick && on && V.current === map ? hit(rclick) : null, i = h && h.n != null && h.p == null ? h.n : -1;
      if (i < 0 || ((shared.sb || cdPal()) && svAt(rclick)) || kindKey(i) == null) return it;   // not over a state variable or unit (its own menu)
      it = it || [];
      it.tail = [['Select all of this kind', function () { selectKind(i); }]];   // the object's last item before Delete
      return it;
    };
    }
    function kindKey(i) {
      var n = nodes2[i];
      if (!n) return null;
      if (shared.cd) { var c1 = cdClsOf(n.id); return c1 ? c1[0] : n.comp ? 'compartment' : null; }
      if (shared.sb) { var c = sbClasses()[n.id]; return c ? c.replace(/ multimer$/, '') : null; }
      return n.shape && n.shape.kind || null;
    }
    function selectKind(i) {
      var key = kindKey(i);
      if (key == null) return;
      shared.selN = nodes2.map(function (n, k) { return kindKey(k) === key && !(shared.afSbgn && inComplex(k)) ? k : -1; }).filter(function (k) { return k >= 0; });   // not the members the SBGN AF view does not draw
      shared.selP = []; shared.selE = []; shared.part = null; shared.svSel = null;
      paint();
    }
    function nodeItems() {
      if (cdPal()) return cdItems();   // a CellDesigner map's (cdcreate.js)
      var P = rclick, k = P && palOn() && !svAt(P) ? madeAt(P) : -1;
      if (k < 0 && P && palOn()) {   // a modulation under the pointer: Change identity, its kinds
        var h = hit(P), ed = h && h.e != null && h.p == null ? edges2[h.e] : null, now = ed && Object.keys(MODK).filter(function (c) { return sbJs.ARROW[c] === ed.arr[1]; })[0];
        var afN = afKind();   // an AF map (the map, not the tab): its influences by AF's names, no catalysis there
        if (now) return lateItem(['Change identity', subItem(function (r, done) {   // its kinds by Change identity (core.js kindWindow), the palette's names
          return kindWindow(r, PAL_PD[4][1].filter(function (q) { return MODK[q[0]] && !(q[0] === 'catalysis' && (afN || ruleSays('catalysis', ed.s, ed.t, h.e))); }).map(function (q) {
            var c = q[0], af = afN && sbJs.AF_ARC[c];
            return { name: af ? af[0].toUpperCase() + af.slice(1) : q[1], own: c === now, go: function () {
              var t2 = sbJs.arcKind(shared.text, ed.id, c);
              commit(t2, { name: 'arc kind', sel: [], selE: [ed.id] });
            } };
          }), done);
        })]);
      }
      // an activity under AF: made another kind, its unit
      // given, or its unit taken off (a protein's activity again: with no auxiliary unit an activity is a protein's)
      var au = k >= 0 && afMap() ? sbJs.activities(shared.text)[nodes2[k].id] : null;
      if (au == null && k >= 0 && afMap() && palKind() === 'af' && !nodes2[k].kids.length) au = sbJs.unitFor(nodes2[k].shape.kind);   // a plain entity of an AF map: written as its activity (an AF file's turned so, toAf; a reduced-notation file keeps the entity's class, sbgn_edit write0)
      if (au === undefined) au = null;
      if (au != null) {
        var aid = nodes2[k].id, setU = function (u) { return function () { commit(sbJs.activity(shared.text, aid, u), { name: 'activity unit', sel: [aid], quiet: true }); }; };
        // its unit's text (free text, not restricted to a vocabulary): typed, or
        // ct:gene and ct:mRNA on a nucleic acid feature's; one unit per activity (AF), so one text
        var ui = svList(k).filter(function (q) { return q[3] === UI; })[0], ut = ui ? ui[0] : '';
        var setT = function (v) { return function () {
          var t2 = ui ? (v === null ? sbJs.unitDelete(shared.text, aid, 0) : sbJs.unitValue(shared.text, aid, 0, v)) : sbJs.unit(shared.text, aid, v);
          commit(t2, { name: 'unit text', sel: [aid], quiet: true });
        }; };
        var typeT = function () {
          if (!ui && !commit(sbJs.unit(shared.text, aid, ''), { name: 'unit added to type in', sel: [aid], quiet: true })) return;
          var j = svList(nodes2.findIndex(function (n) { return n.id === aid; })).map(function (q) { return q[3]; }).indexOf(UI);
          if (j >= 0) typeIn(aid, j, !ui);   // made for this: gone again when nothing is typed
        };
        var texts = [[ut ? 'Edit unit of information text' : 'Add unit of information text', typeT]];
        if (au === 'nucleic acid feature') NAF_CT.forEach(function (c) { if (ut !== c[0]) texts.push(['Unit of information ' + c[0], setT(c[0])]); });
        if (ut) texts.push(['Remove unit of information text', setT(null)]);
        return sbJs.UNITS.filter(function (u) { return u !== au && ACT_NAME[u]; }).map(function (u) { return ['Make ' + ACT_NAME[u], setU(u)]; })
          .concat(au ? [['Remove unit of information', setU('')]] : []).concat(texts);
      }
      var gc = k >= 0 && nodes2[k].shape.kind === 'Operator' ? sbJs.classOf(src(), nodes2[k].id) : '';
      if (/^(and|or|not)$/.test(gc)) {   // the other gates; an equivalence keeps its own rules (entities only)
        var gid = nodes2[k].id;
        var gins = edges2.filter(function (q) { return q.t === k; }).length;
        return ['and', 'or', 'not'].filter(function (c) { return c !== gc && !(c === 'not' && gins > 1); }).map(function (c) {   // a NOT has one input
          return ['Make ' + c.toUpperCase(), function () { commit(sbJs.kind(shared.text, gid, c), { name: 'gate kind', sel: [gid], quiet: true }); }];
        });
      }
      // an entity (macromolecule, simple chemical, nucleic acid feature, unspecified entity; not an Activity Flow activity
      // drawn as one: write() carries none of its changes), as a CellDesigner species: its icons first, then Change
      // identity and Make multimer, after the common items
      var ec = k >= 0 && !afKind() && !svAt(P) ? (sbJs.classOf(src(), nodes2[k].id) || '') : '', eb = ec.replace(/ multimer$/, '');
      if (sbJs.ENTITIES.indexOf(eb) >= 0) {
        var eid = nodes2[k].id, eout = [], emulti = isMulti(k);
        if (eb === 'macromolecule') eout.push(['Add state variable', function () { makeState(P); }], ['Add unit of information', function () { makeUnit(eid); }]);
        if (eb === 'nucleic acid feature') eout.push(['Add unit of information', function () { makeUnit(eid); }],   // the conceptual types offered
          ['Add unit of information ct:mRNA', function () { makeUnit(eid, 'ct:mRNA'); }], ['Add unit of information ct:gene', function () { makeUnit(eid, 'ct:gene'); }]);
        eout.push(['Change identity', subItem(function (r, done) {   // its kinds by the palette's names (core.js kindWindow)
          return kindWindow(r, sbJs.ENTITIES.map(function (c) {
            return { name: c[0].toUpperCase() + c.slice(1), own: c === eb, go: function () { commit(sbJs.entityKind(shared.text, eid, c), { name: 'entity kind', sel: [eid], quiet: true }); } };
          }), done);
        })]);
        if (eb === 'macromolecule') eout.push([emulti ? 'Make macromolecule' : 'Make multimer', function () {
          commit(sbJs.multimer(shared.text, eid, !emulti), { name: 'multimer', sel: [eid], quiet: true });
        }]);
        eout.late = true;   // rarely used: after the common items, above Delete
        return eout;
      }
      var pc = k >= 0 && nodes2[k].shape.kind === 'Process' ? sbJs.classOf(src(), nodes2[k].id) : '';
      if (sbJs.PROCESSES.indexOf(pc) >= 0) {   // its kinds by Change identity, the palette's names (not an association or dissociation of a file)
        var pid = nodes2[k].id, psigns = PAL_PD.filter(function (g) { return g[0] === 'Process nodes'; })[0][1];
        var pit = lateItem(['Change identity', subItem(function (r, done) {
          return kindWindow(r, sbJs.PROCESSES.map(function (c) {
            var q = psigns.filter(function (s) { return s[0] === c; })[0];
            return q && { name: q[1], own: c === pc, go: function () { commit(sbJs.kind(shared.text, pid, c), { name: 'process kind', sel: [pid], quiet: true }); } };
          }).filter(Boolean), done);
        })]);
        // Make reversible or Make irreversible, after Change identity, as on CellDesigner reactions: its consumptions
        // turned into productions from the same port (productions on both sides, SBGN's reversible process), or those on
        // the port-in side turned back (sbgn_edit.reversible); one undo step, the turned lines selected
        var rv = sbJs.reversibility(shared.text, pid, { sbgn: src() });
        if (rv && (rv.can || rv.rev)) pit.push([rv.rev ? 'Make irreversible' : 'Make reversible', function () { sbReversible(pid, !rv.rev, false); }]);
        return pit;
      }
      // a compartment's name in one of its six places (never in the middle):
      // over a named compartment and nothing else, the places it is not in (sbgn_edit.nameAt)
      var stackOn = on && V.current === map && !shared.cd && full() && !!sbJs;   // stacking on GraphML maps too (Full editing), names on SBGN-ML maps
      var hc = k < 0 && P && (palOn() || stackOn) ? hit(P) : null;
      if (hc && hc.n != null && hc.p == null && nodes2[hc.n].comp) {
        var cid = nodes2[hc.n].id, np = palOn() ? sbJs.namePlaces(shared.text, cid) : null, sm = sbJs.stackMoves(shared.text, cid);   // the places its name can take (a name too wide for a side: the middles only); where it partly overlaps another, its order
        var go = function (t2) { commit(t2, { name: 'compartment', sel: [cid], quiet: true }); };
        var its = (np ? np[1] : []).map(function (q) { return [NAME_WORDS[q], function () { go(sbJs.nameAt(shared.text, cid, q)); }]; });
        if (sm[1]) its.push(['Bring forward', function () { go(sbJs.restack(shared.text, cid, 1)); }]);
        if (sm[0]) its.push(['Send backward', function () { go(sbJs.restack(shared.text, cid, -1)); }]);
        if (its.length) return its;
      }
      return null;
    }
    function isMulti(i) {   // drawn as a multimer: yEd's mcount (sbgn_edit.multimer)
      var r = realizerOf(nodes2[i].el), sp = r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'StyleProperties'; })[0];
      return !!sp && Array.prototype.some.call(sp.children, function (c) { return c.getAttribute('name') === 'com.yworks.sbgn.style.mcount' && c.getAttribute('value') !== '1'; });
    }
    // Icons that never touch (notes/state-crowding.md; the CellDesigner copy: cdcreate.js cdRoom, cd_make placesFor): a
    // node's state variables and units of information keep 2 px between their boxes. A new or changed one takes the first
    // free place of svPlaces, worked out from the node's size; with none free the node grows about its centre (svGrowStep),
    // the state variables on a grown side spread again (iconSpread), and the places are worked out again. Nothing else
    // moves, but those state variables and one a unit of information now meets. Never when a map is opened or saved
    // the places by size, as [rx, ry]: inside each side as many as fit a step apart (20: an 18 icon and a 2 gap), spread
    // evenly (sideSlots), and the corners; the order of the places most used (the bottom from the middle outwards, right
    // first, the sides' middles, the bottom corners, the top corners, the top, the sides' other places, lower first). On 80
    // by 40 the corners, the middles and the bottom's and top's quarters; on 100 by 50 four places along the bottom
    function svPlaces(w, h, step) {
      var S = step || 20, bx = sideSlots(w, S), sy = sideSlots(h, S), out = [];
      var near = sy.length ? sy.filter(function (d) { return Math.abs(Math.abs(d) - Math.abs(sy[0])) < 1e-6; }) : [0];
      bx.forEach(function (d) { out.push([d / w, 0.5]); });
      near.forEach(function (d) { out.push([0.5, d / h], [-0.5, d / h]); });
      out.push([0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]);
      bx.forEach(function (d) { out.push([d / w, -0.5]); });
      sy.slice(near.length).forEach(function (d) { out.push([0.5, d / h], [-0.5, d / h]); });
      return out;
    }
    // the places inside a side L long, as distances from its middle: as many as fit S apart between its corners, spread
    // evenly (L / S - 1 of them), nearest the middle first (the positive one, right or lower, before its twin); the
    // CellDesigner copy: cd_make placesFor's slots
    function sideSlots(L, S) {
      var n = Math.max(0, Math.floor(L / S + 1e-9) - 1), o = [];
      for (var j = 1; j <= n; j++) o.push(Math.round((-L / 2 + j * L / (n + 1)) * 1e6) / 1e6);
      return o.sort(function (a, b) { return Math.abs(a) - Math.abs(b) || b - a; });
    }
    // a point p on the border of a box w0 by h0 (from its centre, y down) on the box grown to w by h, at its distance from
    // the middle of its side (a corner stays a corner); off the border in proportion
    function iconKeep(p, w0, h0, w, h) {
      var x = p[0], y = p[1], onX = Math.abs(Math.abs(x) - w0 / 2) < 0.5, onY = Math.abs(Math.abs(y) - h0 / 2) < 0.5, sx = x < 0 ? -1 : 1, sy = y < 0 ? -1 : 1;
      if (onX && onY) return [sx * w / 2, sy * h / 2];
      if (onY) return [x, sy * h / 2];
      if (onX) return [sx * w / 2, y];
      return [x * w / w0, y * h / h0];
    }
    // icons in order at kept distances p (sorted) given places on their side (sorted, as many or more): the places, in
    // order, that move them least; on a tie the outer places taken and, of two as near the middle, the left one, so the
    // place left free is the one svPlaces offers first (nearest the middle, right before left)
    function spreadOn(slots, p) {
      var n = slots.length, m = p.length, C = [], W = [];
      var cost = function (d, x) { return Math.abs(d - x) - 1e-3 * Math.abs(d) - (d < 0 ? 1e-6 : 0); };
      for (var j = 0; j <= m; j++) { C.push([]); W.push([]); for (var k = 0; k <= n; k++) C[j].push(j === 0 ? 0 : Infinity); }
      for (j = 1; j <= m; j++) for (k = j; k <= n; k++) {
        var take = C[j - 1][k - 1] + cost(slots[k - 1], p[j - 1]), skip = C[j][k - 1];
        if (take <= skip) { C[j][k] = take; W[j][k] = 1; } else { C[j][k] = skip; W[j][k] = 0; }
      }
      var out = [];
      for (j = m, k = n; j > 0; k--) if (W[j][k] === 1) { out.unshift(slots[k - 1]); j--; }
      return out;
    }
    // icons moved with their glyph grown from w0 by h0 to w by h, as points from the box's centre (y down); the one master,
    // cdcreate.js cdOn calls it (and iconKeep). mv: { p, s } the icons that may move; fixed: { p, s } the others, already on the new box.
    // Each kept at its distance from the middle of its side (a corner stays a corner); on a side whose length changed its
    // icons are spread again over that side's places (sideSlots), in their order, each as little as can be (spreadOn),
    // so the glyph grows in even steps (notes/state-crowding.md, Steadier growth); a side whose icons would then
    // meet one another or another icon is kept as it was
    function iconSpread(mv, fixed, w0, h0, w, h, S) {
      var meet = function (a, sa, c, sc) { return Math.abs(a[0] - c[0]) < (sa[0] + sc[0]) / 2 + 2 - 1e-6 && Math.abs(a[1] - c[1]) < (sa[1] + sc[1]) / 2 + 2 - 1e-6; };
      var sides = { b: [], r: [], l: [], t: [] }, out = mv.map(function (q) { return iconKeep(q.p, w0, h0, w, h); });
      mv.forEach(function (q, k) {
        var onX = Math.abs(Math.abs(q.p[0]) - w0 / 2) < 0.5, onY = Math.abs(Math.abs(q.p[1]) - h0 / 2) < 0.5;
        if (onY && !onX) sides[q.p[1] > 0 ? 'b' : 't'].push(k); else if (onX && !onY) sides[q.p[0] > 0 ? 'r' : 'l'].push(k);
      });
      ['b', 'r', 'l', 't'].forEach(function (sd) {
        var ks = sides[sd], hz = sd === 'b' || sd === 't', L = hz ? w : h;
        if (!ks.length || Math.abs(L - (hz ? w0 : h0)) < 1e-6) return;
        var at = function (d) { return hz ? [d, sd === 'b' ? h / 2 : -h / 2] : [sd === 'r' ? w / 2 : -w / 2, d]; };
        var o = fixed.concat(mv.map(function (q, k) { return ks.indexOf(k) < 0 ? { p: out[k], s: q.s } : null; }).filter(Boolean));
        var slots = sideSlots(L, S).filter(function (d) { return !o.some(function (f) { return meet(at(d), [S - 2, S - 2], f.p, f.s); }); });
        if (slots.length < ks.length) return;
        var ord = ks.slice().sort(function (a, b) { return hz ? mv[a].p[0] - mv[b].p[0] : mv[a].p[1] - mv[b].p[1]; });
        var res = spreadOn(slots.slice().sort(function (a, b) { return a - b; }), ord.map(function (k) { return hz ? out[k][0] : out[k][1]; })).map(at);
        var ok = ord.every(function (k, j) { return !o.some(function (f) { return meet(res[j], mv[k].s, f.p, f.s); }) && ord.every(function (k2, j2) { return j2 === j || !meet(res[j], mv[k].s, res[j2], mv[k2].s); }); });
        if (ok) ord.forEach(function (k, j) { out[k] = res[j]; });
      });
      return out;
    }
    function svPt(b, r) { return [b[0] + (0.5 + r[0]) * b[2], b[1] + (0.5 + r[1]) * b[3]]; }
    // node i's icons (svIconsOn) on box b, the node grown from b0: its state variables moved as iconSpread moves them, its
    // units of information at their ratios (sbgn_edit keeps them so)
    function svMoved(i, ic, b0, b, S) {
      if (b === b0) return ic;
      var rel = function (B, r) { return [r[0] * B[2], r[1] * B[3]]; }, sv = ic.filter(function (q) { return q.k === SV; });
      var at = iconSpread(sv.map(function (q) { return { p: rel(b0, q.r), s: q.s }; }), ic.filter(function (q) { return q.k !== SV; }).map(function (q) { return { p: rel(b, q.r), s: q.s }; }), b0[2], b0[3], b[2], b[3], S || svStep(i));
      return ic.map(function (q) { var k = sv.indexOf(q); return k < 0 ? q : { r: [at[k][0] / b[2], at[k][1] / b[3]], s: q.s, k: q.k, n: q.n }; });
    }
    function svStep(i) { return Math.max(20, 18 * svK(i) + 2); }   // a place's width: an icon and the 2 px gap
    // node id grown to box nb: its state variables moved as svMoved moves them (their ratios written again); its units of
    // information keep their places too (sbgn_edit keeps their ratios)
    function svGrowTo(id, nb, skip) {   // skip(icon): left out, as svRoom left it out (it moves next)
      var i = nodes2.findIndex(function (n) { return n.id === id; }), b = boxOf(i), ic = svMoved(i, svIconsOn(i).filter(function (q) { return !skip || !skip(q); }), b, nb);
      setText(sbJs.resize(shared.text, id, nb));
      ic.forEach(function (q) { if (q.k === SV) setText(sbJs.stateMove(shared.text, id, q.n, q.r[0], q.r[1])); });
      parse();
    }
    function svIconsOn(i) {   // node i's icons as ratios of its box (sbgn_edit keeps them so through a resize): { r, s, k: kind, n: index among its kind }
      var b = boxOf(i);
      return svList(i).map(function (q) { return { r: [(q[1][0] - b[0]) / b[2] - 0.5, (q[1][1] - b[1]) / b[3] - 0.5], s: q[2], k: q[3], n: q[4] }; });
    }
    function svClash(c, s, b, icons) { return icons.some(function (q) { var p = svPt(b, q.r); return Math.abs(c[0] - p[0]) < (s[0] + q.s[0]) / 2 + 2 - 1e-6 && Math.abs(c[1] - p[1]) < (s[1] + q.s[1]) / 2 + 2 - 1e-6; }); }
    // the next size tried, as cdcreate.js cdGrowStep: one place's width (S) wider and higher in its kind's proportion (80
    // by 40: 100 by 50, 120 by 60, ...), about its centre, so the glyph keeps its kind's shape and grows in even steps
    function svGrowStep(b, base, S) {
      var w = b[2] + S, h = b[3] + S * base[1] / base[0];
      return [b[0] - (w - b[2]) / 2, b[1] - (h - b[3]) / 2, w, h];
    }
    function svBase(i) {
      var c = ((sbClasses()[nodes2[i].id] || '').replace(/ multimer$/, '')) || 'macromolecule', b = boxOf(i);
      try { var D = defOf(c); if (D && D.w && D.h) return [D.w, D.h]; } catch (e) { /* its own size */ }
      return [b[2], b[3]];
    }
    // a free place for an icon of size s on node i: { box: grown (null: as it is), r }; skip(icon): not counted
    function svRoom(i, s, skip) {
      var b0 = boxOf(i), b = b0, base = svBase(i), S = svStep(i), ic0 = svIconsOn(i).filter(function (q) { return !skip || !skip(q); }), c;
      for (var g = 0; g < 80; g++) {
        var ic = svMoved(i, ic0, b0, b, S);   // on the size tried: state variables spread as they will be, units at their ratios
        c = svPlaces(b[2], b[3], Math.max(20, s[1] + 2));
        for (var j = 0; j < c.length; j++) if (!svClash(svPt(b, c[j]), s, b, ic)) return { box: b === b0 ? null : b, r: c[j] };
        b = svGrowStep(b, base, S);
      }
      return { box: b === b0 ? null : b, r: c[0] };
    }
    function svK(i) { var q = svList(i).filter(function (x) { return x[3] === SV; })[0]; return q ? q[2][1] / 18 : 1; }   // the node's icons' scale (a Newt map's own font)
    // after node id's icons changed (a unit added or typed, a state variable j typed): units of information apart from one
    // another (the node grown in width, the units on its top edge spread along it), then state variable j if it meets an icon, or
    // (a unit changed, j null) every state variable a unit meets, moved to its first free place (the node grown where none
    // is); the text changed in place, one undo step with the change; true when it grew (its holders grown by svHold)
    function svSettle(id, j) {
      var i = nodes2.findIndex(function (n) { return n.id === id; });
      if (i < 0) return false;
      var grew = false, base = svBase(i);
      for (var g = 0; g < 80; g++) {
        var b = boxOf(i), ic = svIconsOn(i), us = ic.filter(function (q) { return q.k === UI && Math.abs(q.r[1] + 0.5) < 1e-6; });   // the units on the top edge: only width parts them (one moved elsewhere stays as it is)
        if (!us.some(function (u, k) { return svClash(svPt(b, u.r), u.s, b, us.slice(k + 1)); })) break;
        svGrowTo(id, [b[0] - 10, b[1], b[2] + 20, b[3]]);
        grew = true; i = nodes2.findIndex(function (n) { return n.id === id; });
      }
      for (var h = 0; h < 80; h++) {
        var b2 = boxOf(i), ic2 = svIconsOn(i), us2 = ic2.filter(function (q) { return q.k === UI; });
        var hit = ic2.filter(function (q) { return q.k === SV && (j != null ? q.n === j && svClash(svPt(b2, q.r), q.s, b2, ic2.filter(function (o) { return o !== q; })) : svClash(svPt(b2, q.r), q.s, b2, us2)); })[0];   // a state variable typed: that one alone; a unit changed: those it meets (a file's own overlaps stay)
        if (!hit) break;
        var sk = function (o) { return o.k === SV && o.n === hit.n; }, r = svRoom(i, hit.s, sk);
        if (r.box) { svGrowTo(id, r.box, sk); grew = true; }
        setText(sbJs.stateMove(shared.text, id, hit.n, r.r[0], r.r[1])); parse(); i = nodes2.findIndex(function (n) { return n.id === id; });
      }
      return grew;
    }
    // node id grown from box was: what holds it grown round it, as sbSetSize does (one undo step with the change)
    function svHold(id, was) {
      var k = nodes2.findIndex(function (n) { return n.id === id; });
      if (k < 0) return;
      setBoxes(grown([k], boxOf, function (q) { return q === k ? was : boxOf(q); }, function () { return false; }));
      refit([id]);
    }
    function makeState(P) {   // an empty state variable on the first free place (svRoom: anywhere on the shape, from the bottom; the glyph grown where none is), selected to be dragged
      var i = macroAt(P);
      if (i < 0) return;
      var k = svK(i), room = svRoom(i, [18 * k, 18 * k], null), was = boxOf(i);
      var id = nodes2[i].id, j = svList(i).filter(function (h) { return h[3] === SV; }).length;   // after the state variables, before the units
      commit(null, { name: 'state variable added', sel: [id], quiet: true, reparse: true, write: function () {
        if (room.box) svGrowTo(id, room.box);
        setText(sbJs.state(shared.text, id, '', room.r[0], room.r[1]));
      }, then: function () {
        if (room.box) svHold(id, was);
        svCopies(id).forEach(function (c) { svAddTo(c, room.r, ''); });   // on every copy at the same place (svCopies)
      } });
      shared.selN = []; shared.svSel = { id: id, j: j }; paint();
    }
    // Once a variable, always a variable (as a CellDesigner residue belongs to the protein and shows on every species of
    // it): a state variable belongs to the entity, so every macromolecule of the same name (complex members included)
    // has it, at the same place of its border; its value stays each glyph's own. Made, its variable named or renamed,
    // moved and deleted on every copy in the same undo step; a glyph named as others takes their state variables. A copy's
    // own is found by the variable's name, an unnamed one by its place (svTwin); SBGN-ML maps only. The place taken on a copy: the copy grows
    // a few steps to free it, else the copy's first free place (svRoom); a move to a place taken there leaves the copy's
    // where it was. Process Description maps only (Activity Flow has no state variables)
    function svVar(s) { var a = (s || '').indexOf('@'); return a < 0 ? '' : s.slice(a + 1).trim(); }   // value@variable: the variable
    function svVal(s) { var a = (s || '').indexOf('@'); return a < 0 ? s || '' : s.slice(0, a); }
    function svIdx(id) { return nodes2.findIndex(function (n) { return n.id === id; }); }
    function svOnly(i) { return svList(i).filter(function (q) { return q[3] === SV; }); }
    function svR(i, q) { var b = boxOf(i); return [(q[1][0] - b[0]) / b[2] - 0.5, (q[1][1] - b[1]) / b[3] - 0.5]; }
    function svNm(i) { return nameOf(i).replace(/\s+/g, ' ').trim(); }
    function svCopies(id) {   // the other macromolecules named as node id (an SBGN-ML map's, Process Description): their ids
      var i = svIdx(id);
      if (shared.cd || !shared.sb || shared.afSbgn || afKind() || i < 0 || nodes2[i].shape.kind !== 'Macromolecule' || !svNm(i)) return [];
      var nm = svNm(i);
      return nodes2.filter(function (n, k) { return k !== i && n.shape.kind === 'Macromolecule' && svNm(k) === nm; }).map(function (n) { return n.id; });
    }
    // copy c's state variable answering one with text txt at place r: by its variable's name; an unnamed one at the same
    // place; for an empty one (txt ''), else the copy's empty one nearest r (one made with it where its place was taken).
    // Never by order alone, so a copy's own value-only state variable is never taken for another; -1 for none
    function svTwin(c, txt, r) {
      var k = svIdx(c);
      if (k < 0) return -1;
      var svs = svOnly(k), v = svVar(txt), d = function (q) { var p = svR(k, q); return Math.abs(p[0] - r[0]) + Math.abs(p[1] - r[1]); };
      var hit = v ? svs.filter(function (q) { return svVar(q[0]) === v; })[0]
        : svs.filter(function (q) { return !svVar(q[0]) && d(q) < 0.04; })[0]
          || (!txt ? svs.filter(function (q) { return !q[0]; }).sort(function (a, b) { return d(a) - d(b); })[0] : null);
      return hit ? hit[4] : -1;
    }
    function svSize(i, txt) { var k = svK(i), n = (txt || '').length; return [n <= 2 ? 18 * k : Math.ceil(n * 5.4 * k + 12 * k), 18 * k]; }   // as sbgn_edit sizes it (svIcon)
    function svAddTo(c, r, txt) {   // a state variable txt on copy c at place r (the copy grown a few steps to free it), else its first free place
      var k = svIdx(c);
      if (k < 0) return;
      var s = svSize(k, txt), b0 = boxOf(k), b = b0, base = svBase(k), S = svStep(k), ic0 = svIconsOn(k), at = null;
      for (var g = 0; g < 6 && !at; g++) {
        var ic = svMoved(k, ic0, b0, b, S);
        if (!svClash(svPt(b, r), s, b, ic)) at = { box: b === b0 ? null : b, r: r }; else b = svGrowStep(b, base, S);
      }
      if (!at) at = svRoom(k, s, null);
      if (at.box) svGrowTo(c, at.box);
      setText(sbJs.state(shared.text, c, txt, at.r[0], at.r[1])); parse();
      if (at.box) svHold(c, b0);
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
    function svJoin(id) {   // node id named as other macromolecules: theirs added where it has none (the copy with most as the model)
      var i = svIdx(id), cs = svCopies(id).map(svIdx).sort(function (a, b) { return svOnly(b).length - svOnly(a).length; });
      if (i < 0 || !cs.length) return;
      var k = cs[0], want = svOnly(k).map(function (q) { return [svVar(q[0]), svR(k, q)]; });   // read before anything is added
      want.forEach(function (w) { if (svTwin(id, w[0] ? '@' + w[0] : 'x', w[1]) < 0) svAddTo(id, w[1], w[0] ? '@' + w[0] : ''); });   // an unnamed one matched by its place only
    }
    // an empty unit of information, as with state variables (made at once, its text added by a double
    // click): N:2's box (the converter's smallest), the last on the top, selected; room made for it (svSettle)
    function makeUnit(id, value) {   // value: a unit with its text (ct:mRNA), else an empty one
      var i = nodes2.findIndex(function (n) { return n.id === id; });
      if (i < 0) return;
      var j = svList(i).length, was = boxOf(i);   // the units come last in the node's list
      var t2 = sbJs.unit(shared.text, id, value || '');
      if (!commit(t2, { name: 'unit added', sel: [id], quiet: true, reparse: true, then: function () { if (!shared.afSbgn && svSettle(id, null)) svHold(id, was); } })) return;
      shared.selN = []; shared.svSel = { id: id, j: j }; paint();
    }
    function made(id) {   // the text changed by a palette action: read again, the node (or nodes: an array) selected, drawn, saved
      var ids = [].concat(id);
      parse(); shared.selN = []; shared.selP = []; shared.selE = []; shared.part = null;
      nodes2.forEach(function (n, i) { if (ids.indexOf(n.id) >= 0) shared.selN.push(i); });
      shared.dirty = true; quiet(); render(); paint(); changed();
    }
    // a node's icons: its state variables and units of information (yEd's names), as one list in the order the node has
    // them (state variables first); svSel's j counts in that list, sbgn_edit counts each kind on its own (q[4])
    var SV, UI, SS;
    function __run29() {   // run at start, in order (__start)
    SV = 'StateVariable', UI = 'UnitOfInformation', SS = 'StructuralState';
    }   // SS: CellDesigner's structural state (cdcreate.js)
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
      if (shared.cd) return cdSvList(i);   // a CellDesigner map's, from its file (cdcreate.js)
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
    // map; Enter or leaving it keeps it, Esc not (a unit's text free: N:3, mt:prot, ct:mRNA; a CellDesigner map's icons have windows of their own, cdcreate.js cdSvWin)
    function typeIn(id, j, fresh) {   // fresh: the unit was made for this typing, deleted again when nothing is kept
      if (shared.typing) shared.typing.done(true);
      var i = nodes2.findIndex(function (n) { return n.id === id; });
      if (i < 0) return;
      var b = boxOf(i), sv = j == null ? null : svList(i)[j];
      if (j != null && !sv) return;
      var unit = !!sv && sv[3] === UI;
      shared.selN = []; shared.selP = []; shared.selE = []; shared.part = null; shared.svSel = null; paint();   // only the cursor while typing, nothing shown selected
      // the text edited in place (its colour unchanged): the box
      // inside the glyph's outline, in its fill, text colour and font size, no frame
      var r = realizerOf(nodes2[i].el), fl = r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'Fill'; })[0];
      var lab = !sv ? r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'NodeLabel' && !c.getAttribute('iconData'); })[0] : null;
      var fs = lab ? num(lab, 'fontSize') || 12 : 10, inset = 2;
      // a group's name (a complex, a compartment) typed where it is drawn, in a band of its own across the group: the drawn
      // name's place, else the label's place in the file, else a compartment's top band or a complex's bottom one
      var grp = !sv && nodes2[i].el.getAttribute('yfiles.foldertype') === 'group', nb = grp ? nameBox(i) : null, padL = null, at0;
      if (grp) {
        var bh = Math.min(b[3] - 2 * inset, Math.max(fs * 1.6, nb ? nb[3] + 2 : 0)), ly = lab && lab.hasAttribute('y') ? num(lab, 'y') : null;
        var by = nb ? nb[1] + nb[3] / 2 - bh / 2 : ly != null && ly >= 0 && ly <= b[3] ? b[1] + ly + num(lab, 'height') / 2 - bh / 2 : nodes2[i].comp ? b[1] + inset : b[1] + b[3] - inset - bh;
        at0 = [b[0] + inset, Math.max(b[1] + inset, Math.min(by, b[1] + b[3] - inset - bh)), b[2] - 2 * inset, bh];
        if (nb && Math.abs(nb[0] + nb[2] / 2 - (b[0] + b[2] / 2)) > 2) padL = Math.max(0, nb[0] - at0[0]);   // a name drawn off the middle (a compartment's at its left) typed from where it starts
      } else at0 = !sv ? [b[0] + inset, b[1] + inset, b[2] - 2 * inset, b[3] - 2 * inset] : [sv[1][0] - sv[2][0] / 2 + 1, sv[1][1] - sv[2][1] / 2 + 1, sv[2][0] - 2, sv[2][1] - 2];
      var au0 = unit && shared.afSbgn ? sbJs.activities(shared.text)[id] : null;   // an activity's unit in the SBGN AF view: typed where it is drawn (afUnitBox)
      if (au0 != null) { var B0 = sbJs.afUnitBox(b, au0, sv[0] || 'x'); at0 = [B0[0] + 1, B0[1] + 1, B0[2] - 2, B0[3] - 2]; }
      var r0 = sv && !shared.cd ? svR(i, sv) : null;   // for the copies (svShareText)
      var inp = document.createElement('input'), before = !sv ? (shared.cd ? cdNameOf(id) : nameOf(i)) : sv[0], m0 = map;   // a CellDesigner name from its file (cdcreate.js)
      inp.type = 'text'; inp.className = 'm2-ed-type'; inp.value = before; inp.spellcheck = false;
      inp.setAttribute('aria-label', !sv ? 'Name' : unit ? 'Unit of information' : 'State variable (value, or value@site)');
      // the drawn text hidden while typing, the field itself transparent (a filled field cut the shape's
      // rounded corners); before the editor's own drawing is in the page, the field in the glyph's fill. Whether the
      // drawing is there, not whether it has text: an empty glyph has no text to hide and would still get the filled box
      var hid = au0 != null ? Array.prototype.slice.call(gN && gN[id] ? gN[id].querySelectorAll('text.m2-af-ut') : []) : textsOf(i, j);
      hid.forEach(function (el) { el.style.visibility = 'hidden'; });
      inp.style.background = gN && gN[nodes2[i].id] ? 'transparent' : !sv && fl && fl.getAttribute('hasColor') !== 'false' && fl.getAttribute('color') ? fl.getAttribute('color').slice(0, 7) : '#fff';
      inp.style.color = lab && lab.getAttribute('textColor') || '#000';
      if (shared.cd && shared.cdPend && sv && !sv[0]) { inp.style.background = '#fff'; inp.style.border = '1px solid #000'; }   // a CellDesigner icon not in the file yet: nothing drawn under the field
      var grow = unit || (!!sv && sv[3] === SS);   // a new CellDesigner structural state grows too (cdrender: its text and 12 a side)
      // an SBGN-ML map's state variable or unit of information: the field is the icon itself while typed (white, its outline,
      // a state variable's round ends), sized at every key as sbgn_edit sizes it on Enter (svIcon), the drawn icon hidden
      var own = !!sv && !shared.cd && au0 == null, ik = own ? sv[2][1] / (unit ? 16 : 18) : 1;
      if (own) {
        grow = true; fs = 10 * ik; at0 = [sv[1][0] - sv[2][0] / 2, sv[1][1] - sv[2][1] / 2, sv[2][0], sv[2][1]];
        inp.style.background = '#fff'; inp.style.boxSizing = 'border-box'; inp.style.padding = '0';
        shapesOf(i, j).forEach(function (el) { el.style.visibility = 'hidden'; hid.push(el); });
      }
      var place = function () {   // at the glyph in the map's units: again after every zoom or pan (paint), so a pinch keeps it on its glyph
        var st = inp.style, n = inp.value.length;
        if (grow) {   // a unit of information grows with its text round its centre, as the converter sizes it (5.4 a character, 8 more)
          var cx = at0[0] + at0[2] / 2, uw = !own ? Math.max(at0[2], Math.ceil(n * 5.4 + (unit ? 8 : 24)) + 4)
            : unit ? Math.ceil(Math.max(n, 3) * 5.4 * ik + 8 * ik) : n <= 2 ? 18 * ik : Math.ceil(n * 5.4 * ik + 12 * ik);
          at0[0] = cx - uw / 2; at0[2] = uw;
        }
        st.left = sx(at0[0]) + 'px'; st.top = sy(at0[1]) + 'px'; st.width = at0[2] * V.z + 'px'; st.height = at0[3] * V.z + 'px'; st.fontSize = fs * V.z + 'px';
        if (own) st.border = V.z + 'px solid #000';
        if (sv && !unit) st.borderRadius = at0[3] * V.z / 2 + 'px';
        if (padL != null) { st.textAlign = 'left'; st.paddingLeft = padL * V.z + 'px'; }
      };
      if (grow) inp.addEventListener('input', place);
      place();
      V.view.appendChild(inp);
      shared.typing = {
        done: function (keep) {
          if (!shared.typing || shared.typing.inp !== inp) return;
          shared.typing = null; inp.remove(); hid.forEach(function (el) { el.style.visibility = ''; });
          var v = inp.value.replace(/[\r\n]+/g, ' ');
          if (shared.cd && sv) { if (keep && on && map === m0) cdSsTyped(id, v.trim()); else if (shared.cdPend) { shared.cdPend = null; paint(); } return; }   // a CellDesigner map's new structural state (cdcreate.js)
          if (sv && !unit) v = v.replace(/@+$/, '');   // P@ is P (a site needs a name)
          if (unit) v = v.trim();   // a unit of only spaces is none
          if (fresh && (!keep || !v) && on && map === m0) { var t0 = undo.length ? unpush() : shared.text; if (t0 !== shared.text) { setText(t0); parse(); shared.dirty = true; quiet(); render(); paint(); changed(); } return; }
          if (!keep || v === before.replace(/[\r\n]+/g, ' ') || !on || map !== m0 ) return;   // a name on several lines, untouched, kept as it was (the box shows it on one)
          if (!sv) { setName(id, v); return; }
          var t2 = unit ? sbJs.unitValue(shared.text, id, sv[4], v) : sbJs.stateValue(shared.text, id, sv[4], v);
          if (t2 === shared.text) return;
          if (!fresh) remember(false);   // a unit made for this typing: one step with its making (its step is taken back when nothing is kept, above)
          setText(t2); parse();
          if (au0 == null) { var ix = nodes2.findIndex(function (n) { return n.id === id; }), was = ix >= 0 ? boxOf(ix) : null; if (was && svSettle(id, unit ? null : sv[4])) svHold(id, was); }   // a wider icon given room (notes/state-crowding.md)
          if (au0 == null && !unit) svShareText(id, sv[0], r0, sv[4], v);   // its variable on every copy
          shared.dirty = true; quiet(); render(); paint(); changed();
        }, inp: inp, place: place
      };
      inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); shared.typing && shared.typing.done(true); V.view.focus({ preventScroll: true }); }
        else if (e.key === 'Escape') { e.preventDefault(); shared.typing && shared.typing.done(false); V.view.focus({ preventScroll: true }); }
      });
      inp.addEventListener('blur', function () { if (shared.typing && shared.typing.inp === inp) shared.typing.done(true); });
      inp.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      setTimeout(function () { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 0);   // only the cursor, at the end, nothing selected in blue
    }
    // a name written as typing writes it (typeIn): a CellDesigner map's into its file (cdcreate.js), an SBGN-ML map's label
    function nameNow(i) { return (shared.cd ? cdNameOf(nodes2[i].id) : nameOf(i)).replace(/[\r\n]+/g, ' ').trim(); }   // a name as one line (a CellDesigner one from its file, cdcreate.js)
    function shownName(i) { return (shared.cd ? cdNameOf(nodes2[i].id, true) : nameOf(i)).replace(/[\r\n]+/g, ' ').trim(); }   // the name as drawn: a CellDesigner member still named after its id gives that id
    function setName(id, v) {
      if (shared.cd) { cdRename(id, v); return; }
      if (!sbJs || shared.sb && !edOf(src()).nameable(src(), id)) return;   // a GraphML map's label written as it stands (no SBGN-ML class to ask)
      var t2 = sbJs.label(shared.text, id, v);
      commit(t2, { name: 'name', ids: [id], then: function () { svJoin(id); }, quiet: true });
    }
    // Name by members: a complex named by its members' names joined by colons (A:B, CellDesigner's usual name for
    // a complex), in reading order (rows from the top, each from the left); a member complex with no name gives its own
    // members' names. Offered with Repack complex (core.js) on every map that draws complexes with their members, in Layout
    // and Full editing alike; greyed only when the complex already has that name; members' names as drawn
    function membersName(c) {
      var ms = [], rows = [], mid = function (k, d) { var b = boxOf(k); return b[d] + b[d + 2] / 2; };
      nodes2.forEach(function (n, k) { if (n.up === c) ms.push(k); });
      ms.sort(function (a, b) { return mid(a, 1) - mid(b, 1); }).forEach(function (k) {   // rows from the top: a member joins the row whose first member's middle is within half its height
        var r = rows[rows.length - 1];
        if (r && mid(k, 1) - mid(r[0], 1) <= boxOf(r[0])[3] / 2) r.push(k); else rows.push([k]);
      });
      return [].concat.apply([], rows.map(function (r) { return r.sort(function (a, b) { return mid(a, 0) - mid(b, 0); }); }))
        .map(function (k) { return shownName(k) || (nodes2[k].shape.kind === 'Complex' ? membersName(k) : ''); }).filter(function (s) { return s; }).join(':');
    }
    function __run31() {   // run at start, in order (__start)
    window.m2EditNameHere = function (member) {
      var c = complexHere(member);
      if (c == null || shared.afSbgn || afKind()) return null;   // not in an Activity Flow view, where members are not drawn
      var v = membersName(c), id = nodes2[c].id, go = function () { setName(id, v); };
      go.same = v === nameNow(c) || !shared.cd && (!sbJs || shared.sb && !edOf(src()).nameable(src(), id));   // greyed only when already so named (or the file cannot take a name), so the item stays where it is found
      return go;
    };
    // a double click on a named entity, or on one of its state variables or units of information, opens its text; on a
    // complex or a compartment anywhere off what it holds (a double click has no other use), the field at its drawn name.
    // Without the palette (GraphML maps, Layout editing) groups only: their names, as Name by members, on every map
    V.view.addEventListener('dblclick', function (e) {
      if (!editing(e) || shared.cd && cdPal()) return;   // a CellDesigner map in Full editing: cdcreate.js
      if (tool || Date.now() - placedAt < 600) { e.stopImmediatePropagation(); return; }   // the clicks of a placing: no box
      var full = palOn(), base = src(), P = at(e), q = full ? svAt(P) : null;
      var ok = function (n) { return shared.cd ? !!cdMk : !!sbJs && (!shared.sb || sbJs.nameable(base, n.id)); };   // the file can take the name (setName)
      var grp = function (n) { return n.el.getAttribute('yfiles.foldertype') === 'group'; };
      var nameable = function (n) { return (n.comp || n.shape.kind === 'Complex' && !shared.afSbgn && !afKind() || full && !grp(n)) && ok(n); };
      if (q) { e.stopImmediatePropagation(); typeIn(nodes2[q[0]].id, q[1]); return; }
      var i = nameAt(P, nameable);
      if (i >= 0) { e.stopImmediatePropagation(); typeIn(nodes2[i].id, null); }
    }, true);
    }
    // what a double click at P names, by the selection's own hit (core.js): a node that is no holder names itself or, when it
    // cannot be named here (a member in Layout editing, a process, a gate), nothing; a line or a bend point nothing; else a
    // group's drawn name under P, else the holder round P (a complex or a compartment off what it holds); -1 for none
    function nameAt(P, test) {
      var h = hit(P) || {}, n = h.n != null ? nodes2[h.n] : null, holder = !!n && (n.kids.length > 0 || !!n.comp) && !(shared.afSbgn && n.shape.kind === 'Complex');
      if (n && !holder) return test(n, h.n) ? h.n : -1;
      var g = nameHit(P, test);
      if (g >= 0) return g;
      return n && test(n, h.n) ? h.n : -1;
    }
    function svAt(P) {   // the state variable or unit of information under P: [node, j] (it may stand out of its node)
      if (shared.cd) { if (!cdPal()) return null; } else if (shared.afSbgn || afKind()) return null;   // not drawn in the SBGN AF view; an activity's unit text is set from its right-click menu, never clicked, moved or typed
      var res = shared.cd ? null : svIcons(), found = null, pad = 3 / V.z, acts = shared.sb && palKind() === 'hybrid' ? sbJs.activities(shared.text) : null;   // a hybrid map's activities keep their units as on an AF map
      nodes2.forEach(function (n, k) {
        if (!shared.cd && (n.shape.kind !== 'Macromolecule' && n.shape.kind !== 'NucleicAcidFeature' || (acts && acts[n.id] != null))) return;
        if (shared.cd) { var b = boxOf(k); if (P[0] < b[0] - 80 || P[0] > b[0] + b[2] + 80 || P[1] < b[1] - 12 || P[1] > b[1] + b[3] + 12) return; }   // far from its box: its file not read (a structural state's ellipse may reach out wide)
        svList(k, res).forEach(function (q, j) { if (Math.abs(P[0] - q[1][0]) <= q[2][0] / 2 + pad && Math.abs(P[1] - q[1][1]) <= q[2][1] / 2 + pad) found = [k, j]; });
      });
      return found;
    }

    // a state variable selected: a click selects it, a drag moves it along its node's border, snapping
    // to the nearest of its places (PLACES) only, its own drawing following; the arrow keys move it by single units; a click on it selected opens its text; Delete or the right-click menu
    // deletes it
    var svDrag, svKey;
    function __run32() {   // run at start, in order (__start)
    svDrag = null, svKey = null;
    }   // svSel: { id, j }; svKey: a move by the arrow keys under way
    function svOn() { return palOn() || cdPal(); }   // state variables edited: SBGN-ML maps (Full) and CellDesigner maps (cdcreate.js)
    function svBox(i) { return shared.cd ? cdFront(i, cdFeat(nodes2[i].id)) : boxOf(i); }   // the box its state variables sit round: a CellDesigner multimer's front copy
    function svNode() { if (!shared.svSel) return -1; var i = nodes2.findIndex(function (n) { return n.id === shared.svSel.id; }); return i >= 0 && svList(i)[shared.svSel.j] ? i : -1; }
    function svMarks(over) {   // four black squares at the corners of the state variable selected (paint, core.js)
      if (shared.typing) shared.typing.place();   // the text field follows a zoom or a pan
      cardMarks(over);   // a cardinality selected
      var i = svNode();
      if (i < 0 || !svOn()) { shared.svSel = null; return; }
      var q = svList(i)[shared.svSel.j], c = svDrag && svDrag.to ? svDrag.to : svKey ? svKey.to : q[1], hs = Math.max(2, HANDLE * V.z);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d) {
        over.push('<rect class="m2-ed-handle" x="' + f1(sx(c[0] + d[0] * q[2][0] / 2) - hs / 2) + '" y="' + f1(sy(c[1] + d[1] * q[2][1] / 2) - hs / 2) + '" width="' + f1(hs) + '" height="' + f1(hs) + '"/>');
      });
    }
    // a press on a state variable (called by the core's press before nodes, the state variable being on
    // top): a click on it selects it, also over its macromolecule, selected or not; true when it takes the press
    function svDown(e, P, h) {
      if (cdNameDown(e, P, h)) return true;   // a CellDesigner compartment's name dragged by itself (cdcreate.js)
      if (cardDown(e, P)) return true;   // a cardinality, over its line and what lies under it
      var q = svOn() && !tool ? svAt(P) : null;
      if (!q || e.shiftKey || (h && h.p != null)) { if (shared.svSel) { shared.svSel = null; paint(); } return false; }   // Shift or a bend point there: the core's
      V.view.focus({ preventScroll: true });
      var again = !!shared.svSel && shared.svSel.id === nodes2[q[0]].id && shared.svSel.j === q[1];
      if (!again) { svDrag = { pick: q, x: e.clientX, y: e.clientY }; return true; }   // not selected: a drag goes on to move the map, a click selects it on release
      e.stopImmediatePropagation();
      shared.selN = []; shared.selP = []; shared.selE = []; shared.part = null;
      shared.svSel = { id: nodes2[q[0]].id, j: q[1] };
      svDrag = { i: q[0], again: again, x: e.clientX, y: e.clientY, to: null, r: null, fixed: !!shared.cd && svList(q[0])[q[1]][3] === UI };   // a CellDesigner unit of information stays at the top (its angle's convention not known)
      paint();
      return true;
    }
    function textsOf(i, j, res) {   // the drawn text of node i's name (j null) or of its j-th icon; res: svIcons(), read once by a caller going through many nodes
      var g = gN && gN[nodes2[i].id];
      if (!g) return [];
      var svs = svList(i, res), r = V.view.getBoundingClientRect(), k = V.pz();
      var rect = function (q) { var L = r.left + sx(q[1][0] - q[2][0] / 2) * k, T = r.top + sy(q[1][1] - q[2][1] / 2) * k; return [L - 1.5, T - 1.5, L + q[2][0] * V.z * k + 1.5, T + q[2][1] * V.z * k + 1.5]; };
      var inside = function (b, R) { var cx = b.left + b.width / 2, cy = b.top + b.height / 2; return cx >= R[0] && cx <= R[2] && cy >= R[1] && cy <= R[3]; };
      return Array.prototype.filter.call(g.querySelectorAll('text:not(.m2-af-ut)'), function (t) {   // not an activity's unit text of the SBGN AF view
        if (t.closest('[data-n]') !== g) return false;   // a member's own drawing, if nested, is not this node's text
        if (!t.getClientRects().length) return false;   // not drawn (a site hidden by Show sites)
        var b = t.getBoundingClientRect();
        return j == null ? !svs.some(function (q) { return inside(b, rect(q)); }) : inside(b, rect(svs[j]));
      });
    }
    function shapesOf(i, j) {   // the drawn outline and fill of node i's j-th icon (its text: textsOf)
      var g = gN && gN[nodes2[i].id], q = g && svList(i)[j];
      if (!q) return [];
      var r = V.view.getBoundingClientRect(), k = V.pz(), L = r.left + sx(q[1][0] - q[2][0] / 2) * k, T = r.top + sy(q[1][1] - q[2][1] / 2) * k, W = q[2][0] * V.z * k, H = q[2][1] * V.z * k;
      return Array.prototype.filter.call(g.querySelectorAll('path, rect, ellipse, circle, polygon'), function (el) {
        if (el.closest('[data-n]') !== g) return false;
        var b = el.getBoundingClientRect();
        return Math.abs(b.left - L) < 3 && Math.abs(b.top - T) < 3 && Math.abs(b.width - W) < 4 && Math.abs(b.height - H) < 4;
      });
    }
    function nameBox(i, res) {   // the drawn name of node i as a box in the map's units [x, y, w, h], null when none is drawn (texts not in its name, a CellDesigner state or count, left out)
      var nm = nameNow(i), ts = textsOf(i, null, res).filter(function (t) { var x = t.textContent.trim(); return x && nm.indexOf(x) >= 0; });
      if (!ts.length) return null;
      var r = V.view.getBoundingClientRect(), k = V.pz(), L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
      ts.forEach(function (t) { var q = t.getBoundingClientRect(); L = Math.min(L, q.left); T = Math.min(T, q.top); R = Math.max(R, q.right); B = Math.max(B, q.bottom); });
      var X = function (c) { return ((c - r.left) / k - V.tx) / V.z + x0; }, Y2 = function (c) { return ((c - r.top) / k - V.ty) / V.z + y0; };
      return [X(L), Y2(T), X(R) - X(L), Y2(B) - Y2(T)];
    }
    function nameHit(P, test) {   // the innermost group (a complex, a compartment) whose drawn name lies under P and passes test: its name is edited where it is drawn
      var best = -1, area = Infinity, pad = 3 / V.z, res = null;
      nodes2.forEach(function (n, k) {
        var b = boxOf(k);
        if (n.el.getAttribute('yfiles.foldertype') !== 'group' || b[2] * b[3] >= area || P[0] < b[0] - 20 || P[1] < b[1] - 20 || P[0] > b[0] + b[2] + 20 || P[1] > b[1] + b[3] + 20 || !test(n, k)) return;   // a name drawn in or just by its group
        var nb = nameBox(k, res = res || svIcons());
        if (nb && P[0] >= nb[0] - pad && P[0] <= nb[0] + nb[2] + pad && P[1] >= nb[1] - pad && P[1] <= nb[1] + nb[3] + pad) { area = b[2] * b[3]; best = k; }
      });
      return best;
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
    function __run33() {   // run at start, in order (__start)
    window.addEventListener('pointermove', function (e) {
      if (svDrag && svDrag.pick) { if (!e.buttons || Math.hypot(e.clientX - svDrag.x, e.clientY - svDrag.y) >= 5) svDrag = null; return; }   // the map moved: no click
      if (!svDrag || !shared.svSel) return;
      if (!e.buttons) { svUp(); return; }   // released outside the window: no sticky hand
      if (!svDrag.to && Math.hypot(e.clientX - svDrag.x, e.clientY - svDrag.y) < 4) return;
      if (svDrag.fixed) { svDrag.moved = true; return; }   // a drag on it is no click
      var i = svDrag.i, b = svBox(i), r = border(i, at(e)), q = svList(i)[shared.svSel.j];
      if (!svDrag.parts) svDrag.parts = svParts(i, q);   // the state variable itself moves, as other items on the map, no copy
      svDrag.r = r; svDrag.to = [b[0] + (0.5 + r[0]) * b[2], b[1] + (0.5 + r[1]) * b[3]];
      var dx = svDrag.to[0] - q[1][0], dy = svDrag.to[1] - q[1][1];
      svDrag.parts.forEach(function (el) { if (dx || dy) el.setAttribute('transform', 'translate(' + f1(dx) + ' ' + f1(dy) + ')'); else el.removeAttribute('transform'); });
      paint();
    }, true);
    window.addEventListener('pointerup', svUp, true);
    }   // capture: the core's own handlers may stop the release on the map
    function svUp(e) {
      var d = svDrag; svDrag = null;
      if (!d) return;
      if (d.pick) {   // a click on one not selected: selected now, the viewer's release (a pick) not run
        if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
        shared.selN = []; shared.selP = []; shared.selE = []; shared.part = null; shared.svSel = { id: nodes2[d.pick[0]].id, j: d.pick[1] }; paint(); return;
      }
      if (d.r && shared.svSel) svMove(d.i, shared.svSel.j, d.r);
      else if (d.again && !d.moved && shared.svSel) (shared.cd ? cdSvOpen : typeIn)(shared.svSel.id, shared.svSel.j);   // a click on it selected: its text (a CellDesigner map's: its window, cdcreate.js)
    }
    function svMove(i, j, r) {   // the state variable j of node i written at the place r (a CellDesigner map's: cdcreate.js)
      if (shared.cd) { cdSvMove(i, j, r); return; }
      var q = svList(i)[j], share = q[3] === SV ? svShareMove(i, q, svR(i, q), r) : null;   // the copies too
      if (!commit((q[3] === UI ? sbJs.unitMove : sbJs.stateMove)(shared.text, nodes2[i].id, q[4], r[0], r[1]), { name: 'state variable moved', ids: [nodes2[i].id], then: share })) { render(); paint(); }
    }
    function svDelete() {
      var i = svNode();
      if (i < 0) return false;
      if (shared.cd) { var j = shared.svSel.j; shared.svSel = null; return cdSvDelete(i, j); }
      var q = svList(i)[shared.svSel.j];
      var share = q[3] === SV ? svShareMove(i, q, svR(i, q), null) : null;   // the copies too
      var sid = shared.svSel.id;
      if (!commit((q[3] === UI ? sbJs.unitDelete : sbJs.stateDelete)(shared.text, sid, q[4], { sbgn: shared.sb.base }), { name: 'state variable deleted', ids: [sid], then: function () { shared.svSel = null; if (share) share(); } })) { shared.svSel = null; render(); paint(); }
      return true;
    }
    // a cardinality (a consumption's or production's number; SBGN-ML maps): a click selects it with its line (Properties
    // shows the line's rows, Cardinality last), a press on it selected drags it along its line, to the side the pointer is
    // on, never past its ends (half its box short of them); with Snap a stop every Grid size from the entity's end and at
    // the middle; the arrow keys move it along its line (an arrow nearer across it: to that side), Snap's step or 1, Shift
    // 10; Delete takes it out; Esc during a drag puts it back; a click on it selected puts the cursor in Cardinality. Its
    // place is kept as sbgn_edit's pos (the GraphML label's ratio and side, the SBGN-ML glyph's bbox), drawn again where
    // its line runs after a move (sbgn.js sbPlace). A CellDesigner map's: cdcreate.js cdCardDown
    var cardSel, cardDrag, cardKey, cardMemo;
    function __run34() {   // run at start, in order (__start)
    cardSel = null, cardDrag = null, cardKey = null, cardMemo = [null, null];
    }
    function cardAll() { if (cardMemo[0] !== shared.text) cardMemo = [shared.text, shared.sb && sbJs && sbJs.countsAt ? sbJs.countsAt(shared.text) : {}]; return cardMemo[1]; }
    function cardAt(P) {   // the id of the line whose cardinality's box is under P (map units)
      if (!shared.sb || !sbJs || !sbJs.countsAt || shared.text.indexOf('<y:EdgeLabel') < 0) return null;
      var o = cardAll(), pad = 2 / V.z, got = null;
      Object.keys(o).forEach(function (id) { var b = o[id].box; if (P[0] >= b[0] - pad && P[0] <= b[0] + b[2] + pad && P[1] >= b[1] - pad && P[1] <= b[1] + b[3] + pad) got = id; });
      return got;
    }
    function cardK(id) { return edges2.findIndex(function (q) { return q.id === id; }); }
    function cardOn() { if (!cardSel) return null; var k = cardK(cardSel.id), c = cardAll()[cardSel.id]; if (k < 0 || !c || shared.selE.length !== 1 || shared.selE[0] !== k || shared.selN.length || shared.selP.length) { cardSel = null; return null; } return c; }
    function cardLen(line) { return sbJs.countLens(line).reduce(function (t, v) { return t + v; }, 0); }
    function cardClamp(c, r) {   // r kept half the box's length (and 1) off the line's ends, to 4 decimals
      var tot = cardLen(c.line), m = tot ? (2.5 * c.text.length + 4) / tot : 0.5;
      r = m >= 0.5 ? 0.5 : Math.max(m, Math.min(1 - m, r));
      return Math.round(r * 10000) / 10000;
    }
    function cardDir(c, r) {   // the line's way (entity to process) at r
      var L = c.line, lens = sbJs.countLens(L), d = r * cardLen(L);
      for (var i = 0; i < lens.length; i++) { if ((d <= lens[i] || i === lens.length - 1) && lens[i]) return [(L[i + 1][0] - L[i][0]) / lens[i], (L[i + 1][1] - L[i][1]) / lens[i]]; d -= lens[i]; }
      return [1, 0];
    }
    function cardSide(c) {   // the side it is drawn on now: 1 left of the line's way, -1 right
      if (c.pos) return c.pos.s;
      var b = c.box, q = sbJs.countAlong(c.line, [b[0] + b[2] / 2, b[1] + b[3] / 2]);
      return q ? q[1] : 1;
    }
    function cardParts(c) {   // its drawn box and number in the editor's drawing, hidden while it moves
      var gs = gE && gE[cardSel.id];
      if (!gs) return [];
      var r = V.view.getBoundingClientRect(), k = V.pz(), b = c.box, L = r.left + sx(b[0]) * k - 2, T = r.top + sy(b[1]) * k - 2, R = r.left + sx(b[0] + b[2]) * k + 2, B = r.top + sy(b[1] + b[3]) * k + 2, out = [];
      gs.forEach(function (g) { Array.prototype.forEach.call(g.querySelectorAll('rect, text'), function (el) {
        var q = el.getBoundingClientRect();
        if (q.width + q.height > 0 && q.left >= L && q.right <= R && q.top >= T && q.bottom <= B) out.push(el);
      }); });
      return out;
    }
    function cardShow(parts, on) { parts.forEach(function (el) { el.style.visibility = on ? '' : 'hidden'; }); }
    function cardMarks(over) {   // the box where it is or goes, with four black squares at its corners (paint, through svMarks)
      var c = cardOn();
      if (!c) return;
      var to = cardDrag && cardDrag.to || cardKey && cardKey.to, b = to ? sbJs.countOn(c.line, c.text, to) : c.box, hs = Math.max(2, HANDLE * V.z);
      if (to) over.push('<rect x="' + f1(sx(b[0])) + '" y="' + f1(sy(b[1])) + '" width="' + f1(b[2] * V.z) + '" height="' + f1(b[3] * V.z) + '" fill="#fff" stroke="#9aa0a6" stroke-width="' + f1(0.8 * V.z) + '"/>' +
        '<text x="' + f1(sx(b[0] + b[2] / 2)) + '" y="' + f1(sy(b[1] + b[3] / 2 + 3.2)) + '" font-family="Arial, Helvetica, sans-serif" font-size="' + f1(9 * V.z) + '" fill="#9aa0a6" text-anchor="middle">' + c.text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>');
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (d) {
        over.push('<rect class="m2-ed-handle" x="' + f1(sx(b[0] + d[0] * b[2]) - hs / 2) + '" y="' + f1(sy(b[1] + d[1] * b[3]) - hs / 2) + '" width="' + f1(hs) + '" height="' + f1(hs) + '"/>');
      });
    }
    function cardDown(e, P) {   // a press on a cardinality (svDown, before state variables): true when it takes the press
      if (tool || e.shiftKey) return false;
      if (shared.cd) return cdCardDown(e);   // no place in a CellDesigner file (cdcreate.js)
      var id = cardAt(P), k = id == null ? -1 : cardK(id);
      if (k < 0) return false;
      V.view.focus({ preventScroll: true });
      if (!(cardOn() && cardSel.id === id)) { cardDrag = { pick: k, id: id, x: e.clientX, y: e.clientY }; return true; }   // not selected: a click selects it on release, a drag moves the map
      e.stopImmediatePropagation(); e.preventDefault();
      cardDrag = { id: id, x: e.clientX, y: e.clientY, to: null, c: cardAll()[id] };
      return true;
    }
    function cardTo(c, r, s, free) {   // r on Snap's stops (every Grid size from the entity's end, and the middle) unless free
      if (gridSet.snap && !free) {
        var tot = cardLen(c.line), st = gridSet.step / (tot || 1), g = Math.round(r / st) * st;
        r = Math.abs(r - 0.5) < Math.abs(r - g) ? 0.5 : g;
      }
      return { r: cardClamp(c, r), s: s };
    }
    function __run35() {   // run at start, in order (__start)
    window.addEventListener('pointermove', function (e) {
      var d = cardDrag;
      if (!d) return;
      var far = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (d.pick != null) { if (!e.buttons || far >= 5) cardDrag = null; return; }   // the map moved: no click
      if (!e.buttons) { cardUp(); return; }
      if (!d.to && far < 4) return;
      var q = sbJs.countAlong(d.c.line, at(e));
      if (!q) return;
      if (!d.parts) { d.parts = cardParts(d.c); cardShow(d.parts, false); }
      d.to = cardTo(d.c, q[0], q[1], e.altKey || e.ctrlKey);
      paint();
    }, true);
    window.addEventListener('pointerup', cardUp, true);
    }
    function cardUp(e) {
      var d = cardDrag; cardDrag = null;
      if (!d) return;
      if (d.pick != null) {   // a click: selected, with its line
        if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();
        shared.selN = []; shared.selP = []; shared.selE = [d.pick]; shared.part = null; shared.svSel = null; cardSel = { id: d.id }; paint(); return;
      }
      if (d.to && cardSel) { cardMove(d.id, d.to); return; }
      if (d.parts) cardShow(d.parts, true);
      var f = !d.to && cardOn() && document.getElementById('m2-ed-card');   // a click on it selected: its number typed in Properties
      if (f && !f.closest('[hidden]')) { f.focus(); f.select(); }
      paint();
    }
    function cardMove(id, pos) {
      var t2 = sbJs.countMove(shared.text, id, pos);
      if (!commit(t2, { name: 'cardinality moved', ids: [id] })) { render(); paint(); }
    }
    function __run36() {   // run at start, in order (__start)
    window.addEventListener('keydown', function (e) {
      if (!cardSel || /input|textarea|select/i.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape' && cardDrag && cardDrag.to) { if (cardDrag.parts) cardShow(cardDrag.parts, true); cardDrag = null; e.preventDefault(); e.stopImmediatePropagation(); paint(); return; }
      var c = cardOn();
      if (!c) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault(); e.stopImmediatePropagation();
        var cid = cardSel.id, t2 = sbJs.recount(shared.text, cid, ''); cardSel = null;
        commit(t2, { name: 'cardinality taken off', ids: [cid] });
        return;
      }
      var d = KEYS[e.key];
      if (!d) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (!cardKey) cardKey = { id: cardSel.id, at: c.pos ? c.pos.r : 0.5, s: cardSide(c), parts: cardParts(c) };
      cardShow(cardKey.parts, false);
      var u = cardDir(c, cardKey.at), a = d[0] * u[0] + d[1] * u[1], n = d[0] * -u[1] + d[1] * u[0], tot = cardLen(c.line) || 1;
      if (Math.abs(a) >= Math.abs(n)) cardKey.at = cardClamp(c, cardKey.at + Math.sign(a) * (e.shiftKey ? 10 : 1) * (gridSet.snap ? gridSet.step : 1) / tot);
      else cardKey.s = n > 0 ? 1 : -1;   // nearer across the line: to that side
      cardKey.to = { r: cardKey.at, s: cardKey.s };
      paint();
    }, true);
    window.addEventListener('keyup', function (e) {
      if (!KEYS[e.key] || !cardKey) return;
      var k = cardKey; cardKey = null;
      if (k.to && cardSel && cardSel.id === k.id) cardMove(k.id, k.to); else { cardShow(k.parts, true); paint(); }
    }, true);
    }
    function nodesDelete(list, arcs) {   // the glyphs the palette makes, an empty compartment too, deleted with every line at them,
      // and the lines selected with them (one undo step, as cdDelete on a CellDesigner map)
      list = list.concat(nodes2.map(function (n, k) { return n.sub != null && list.indexOf(n.sub) >= 0 && list.indexOf(k) < 0 ? k : -1; }).filter(function (k) { return k >= 0; }));   // a submap's terminals go with it (as Newt)
      var ids = list.filter(function (i) { return isMade(nodes2[i]) || emptyComp(nodes2[i]); }).map(function (i) { return nodes2[i].id; });
      var eids = (arcs || []).map(function (k) { return edges2[k] && edges2[k].id; }).filter(Boolean);
      if (!ids.length && !eids.length) return false;
      var t2 = ids.length ? sbJs.remove(shared.text, ids) : shared.text;
      if (eids.length) t2 = sbJs.arcRemove(t2, eids);
      return commit(t2, { name: 'deleted', ids: ids.concat(eids), sel: [] });
    }
    // the arrow keys move the state variable selected round its node's border by 1 unit, with Shift by 10, along
    // the border, free of the places. The key's direction along the
    // side: on the bottom Right and Down go right, Left and Up go left; a key across the side goes clockwise inward,
    // anticlockwise outward. A key held keeps its first direction round the corners.
    // Drawn live, written once on the key's release (one undo step)
    var KEYS;
    function __run37() {   // run at start, in order (__start)
    KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    }
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
    function keyDir(b, t, d) {   // +1 clockwise, -1 anticlockwise; as the arrow points wherever it can (on a side, Down is down)
      var w = b[2], h = b[3], P = perim(b), sideOf = function (u) { u = ((u % P) + P) % P; return u < w ? 0 : u < w + h ? 1 : u < 2 * w + h ? 2 : 3; };
      var TAN = [[1, 0], [0, 1], [-1, 0], [0, -1]], OUT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      var sides = [sideOf(t), sideOf(t - 0.5), sideOf(t + 0.5)];   // at a corner both its sides: the one the arrow runs along
      for (var k = 0; k < sides.length; k++) { var a = d[0] * TAN[sides[k]][0] + d[1] * TAN[sides[k]][1]; if (a) return Math.sign(a); }
      return d[0] * OUT[sides[0]][0] + d[1] * OUT[sides[0]][1] > 0 ? -1 : 1;   // across the side: clockwise inward, anticlockwise outward
    }
    function __run38() {   // run at start, in order (__start)
    document.addEventListener('keydown', function (e) {
      var d = KEYS[e.key];
      if (!d || !shared.svSel || !svOn() || e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      var i = svNode();
      if (i < 0 || (shared.cd && svList(i)[shared.svSel.j][3] === UI)) return;   // a CellDesigner unit of information: not moved
      e.preventDefault(); e.stopImmediatePropagation();
      var b = svBox(i), q = svList(i)[shared.svSel.j];
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
      if (!k.r || !shared.svSel) return;
      svMove(k.i, shared.svSel.j, k.r);
    }, true);
    document.addEventListener('keydown', function (e) {   // Esc, undo, redo and select all leave no state variable selected
      if (shared.svSel && (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && /^[zya]$/i.test(e.key)))) { shared.svSel = null; paint(); }
    }, true);
    document.addEventListener('keydown', function (e) {
      if ((e.key !== 'Delete' && e.key !== 'Backspace') || !svOn() || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (shared.cd) { if (svDelete()) { e.preventDefault(); e.stopImmediatePropagation(); } return; }   // the rest of a CellDesigner map's: cdcreate.js
      if (svDelete() || ((shared.selN.length || (shared.selE.length && !shared.selP.length)) && nodesDelete(shared.selN, shared.selP.length ? [] : shared.selE))) { e.preventDefault(); e.stopImmediatePropagation(); }   // an area's bend points go with their lines, as the menu's Delete; bend points alone are core.js's
    }, true);
    window.m2EditDelete = function () {   // the right-click menu's Delete over a state variable, a unit of information, a macromolecule or a simple chemical
      if (cdPal()) return cdDeleteItem();   // a CellDesigner map's (cdcreate.js)
      if (!palOn() || !rclick) return null;
      var q = svAt(rclick);
      if (q) return function () { shared.svSel = { id: nodes2[q[0]].id, j: q[1] }; svDelete(); };
      var i = madeAt(rclick);
      if (i < 0) i = innermost(rclick, emptyComp);
      if (i >= 0) return function () { if (shared.selN.indexOf(i) >= 0) nodesDelete(shared.selN, shared.selP.length ? [] : shared.selE); else nodesDelete([i]); };   // over the selection: all of it (as the key)
      var h = hit(rclick);   // a line: everything selected with it, or it alone
      if (!h || h.e == null || h.p != null) return null;
      return function () { if (shared.selE.indexOf(h.e) >= 0 && !shared.selP.length) nodesDelete(shared.selN, shared.selE); else arcsDelete([h.e]); };
    };
    }
    function arcsDelete(list) {   // arcs deleted, the file's own and those made (Settings, Editing on Full, SBGN-ML maps)
      var ids = list.map(function (k) { return edges2[k] && edges2[k].id; }).filter(Boolean);
      if (!ids.length) return false;
      return commit(sbJs.arcRemove(shared.text, ids), { name: 'arcs deleted', ids: ids, sel: [] });
    }

    // a sign dragged from the palette onto the map: the future node at its own size and the map's zoom
    // follows the pointer inside the map window only, so over the panel it is hidden behind it and slides in as it nears
    // the map, as if already on the map behind the panel; it is put where it is dropped
    var palDrag, GHOST;
    function __run39() {   // run at start, in order (__start)
    palDrag = null;
    GHOST = { submap: 'rectangle', compartment: 'roundrectangle', process: 'rectangle', 'omitted process': 'rectangle', 'uncertain process': 'rectangle' };   // the outline a dragged sign is drawn with where yEd's kind (sbgn_edit's MAKE) is not outlineD's
    pal.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('button[data-make]');
      if (b && e.button === 0 && !ARCS[b.dataset.make] && !CD_GATE[b.dataset.make]) palDrag = { kind: b.dataset.make, x: e.clientX, y: e.clientY, img: null };   // a gate is clicked, never dropped
    });
    }
    function palOver(e) { var r = V.view.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
    var link;
    function __run40() {   // run at start, in order (__start)
    window.addEventListener('pointermove', function (e) {
      if (!palDrag) return;
      if (!e.buttons) { if (palDrag.img) palDrag.img.remove(); palDrag = null; return; }   // released outside the window
      if (!palDrag.moved && Math.hypot(e.clientX - palDrag.x, e.clientY - palDrag.y) < 5) return;
      palDrag.moved = true;
      if (!(palOn() || cdPal())) { if (palDrag.img) palDrag.img.hidden = true; return; }
      if (!palDrag.img && cdKind(palDrag.kind)) {   // CellDesigner's shape at its size (cdcreate.js)
        var cg = cdGhost(palDrag.kind);
        palDrag.img = document.createElement('div'); palDrag.img.className = 'm2-ed-palghost';
        palDrag.img.style.cssText = 'width:' + cg.w * V.z + 'px;height:' + cg.h * V.z + 'px';
        palDrag.img.innerHTML = cg.svg;
        V.view.appendChild(palDrag.img);
      }
      if (!palDrag.img) {   // in the map window from the start, so it slides in from behind the panel as it nears the map
        var D = defOf(palDrag.kind);
        palDrag.img = document.createElement('div'); palDrag.img.className = 'm2-ed-palghost';
        palDrag.img.style.cssText = 'width:' + D.w * V.z + 'px;height:' + D.h * V.z + 'px';
        // drawn as the renderer draws the glyph (a CSS box with a 1 px border looks thin, its corners
        // round where yrender's are quadratic): its outline in map units (outlineD, core.js; radius 10, as sbgn_edit
        // writes), its border; a compartment unfilled, so the map shows through it
        var w = D.w, h = D.h, cmp = palDrag.kind === 'compartment', au = ACT_UNIT[baseKind(palDrag.kind)], act = shared.afSbgn && au != null, sh = act ? { kind: 'Macromolecule', props: { radius: '0' } } : { kind: GHOST[palDrag.kind] || sbJs.MAKE[au != null ? sbJs.unitClass(au) : baseKind(palDrag.kind)], props: { radius: '10', radiusX: '12', radiusY: '12' } };   // in the SBGN AF view an activity's rectangle, else its entity
        var ink = '" fill="' + (D.fill || (cmp ? 'none' : '#fff')) + '" stroke="' + (D.line || '#000') + '" stroke-width="' + (D.width || (cmp ? 2 : 1)) + '"/>';
        palDrag.img.innerHTML = '<svg width="100%" height="100%" viewBox="0 0 ' + w + ' ' + h + '" overflow="visible"><path d="' + outlineD(sh, 0, 0, w, h) + ink +
          (palDrag.kind === 'source and sink' ? '<path d="M0 ' + h + 'L' + w + ' 0' + ink : '') +
          (sbJs.SIGN[palDrag.kind] ? '<text x="' + w / 2 + '" y="' + h * 0.75 + '" text-anchor="middle" font-family="Dialog, Arial, sans-serif" font-size="' + h * 0.75 + '">' + sbJs.SIGN[palDrag.kind] + '</text>' : '') +
          (sbJs.GATE[palDrag.kind] ? '<text x="' + w / 2 + '" y="' + (h / 2 + 4.5) + '" text-anchor="middle" font-family="Dialog, Arial, sans-serif" font-size="12">' + sbJs.GATE[palDrag.kind] + '</text>' : '') + '</svg>';   // the sign as the renderer writes it
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
      if (!palOver(e) || !(palOn() || cdPal())) return;
      placedAt = Date.now();
      if (cdKind(d.kind)) { if (cdPal()) cdMake(at(e), d.kind); return; }
      makeEntity(at(e), d.kind);
    }, true);

    // ---------- arcs drawn by a drag from a node with an arc's sign picked ----------
    // With Settings, Editing on Full: a drag from a node with a sign of
    // Connecting arcs picked, draws a line to where it is let go (a click still selects). The kind is guessed from the two
    // ends, no connector type needed: an entity to a
    // process a consumption, ending on its port in; a process to an entity a production, from its port out; an entity to
    // an entity a process made midway with both,
    // one undo step; anything else refused with the reason. A process's first arc sets its axis, the nearer of horizontal
    // or vertical (sbgn_edit.connect). A sign picked in the palette's Connecting arcs is used as it is, from any node,
    // selected or not; let go on empty space, nothing is made. Delete, or Delete in the right-click menu, removes an arc.
    link = null;
    }   // { from, x, y, moved, to, P, how }
    function linkEnd(P, not) {   // the innermost entity, process, gate, phenotype or submap under P (a complex, not its member: roleOf), not node `not`
      var R = 4 / V.z, best = -1, ba = Infinity;
      nodes2.forEach(function (n, i) {
        var b = boxOf(i), r = shared.cd ? cdRole(i) : roleOf(i) || (hybOn() && nodes2[i].shape.kind === 'Submap' ? 'sub' : null);   // a submap, with Reduced notation ticked: linkKind0 decides
        if (i === not || !r || P[0] < b[0] - R || P[0] > b[0] + b[2] + R || P[1] < b[1] - R || P[1] > b[1] + b[3] + R) return;
        if (b[2] * b[3] < ba) { ba = b[2] * b[3]; best = i; }
      });
      return best < 0 && shared.cd ? cdLineAt(P, not) : best;   // a CellDesigner reaction taken by its main line (cdcreate.js)
    }
    var downs;
    function __run41() {   // run at start, in order (__start)
    downs = new Set();   // the pointers down on the map: a second finger (a pinch) never begins a line
    window.addEventListener('pointerdown', function (e) { downs.add(e.pointerId); }, true);   // before the map's own (core.js stops the press it takes)
    ['pointerup', 'pointercancel'].forEach(function (k) { window.addEventListener(k, function (e) { downs.delete(e.pointerId); }, true); });
    }
    // A line starts only from a node with an arc's sign picked in the palette. With no sign picked, a drag on a node not
    // selected moves the map, as in the viewer, so a missed aim never starts a line.
    function linkDown(e, P, h) {   // a press on a node with an arc's sign picked: a line begun there
      if (!(palOn() || cdPal()) || e.shiftKey || downs.size > 1 || link) return false;
      if (!arcTool()) return false;   // no sign picked: a drag on a node moves the map (or what is selected)
      if (h.n == null && !h.glyph && !(shared.cd && cdOnLine())) return false;   // a press on a line or a bend point selects it, but for CellDesigner's Add reactant, Add product and a line's sign kept in hand
      var i = linkEnd(P, -1);
      if (i < 0) return false;
      if (shared.cd && !cdStartOk(i)) return false;   // a CellDesigner gate's one line out is made with it: a drag moves the gate; Add reactant and Add product from their own ends only
      e.stopImmediatePropagation(); e.preventDefault();
      V.view.setPointerCapture(e.pointerId); V.view.focus({ preventScroll: true });
      link = { from: i, pid: e.pointerId, x: e.clientX, y: e.clientY, moved: false, to: -1, P: P, how: null, at: shared.text };
      shared.tap = { h: h, shift: false, x: e.clientX, y: e.clientY };   // no drag: a click, which selects (release, core.js)
      return true;
    }
    // what a line from node a to node b makes: { cls }, { pair }, { no: the reason }, or null over nothing. P: where it is
    // let go. With no kind picked (linkHow, a sign that does not fit the ends): an entity
    // into a process a consumption, or a modulation when it lands on a side off the antennas of a process that has them;
    // a process to an entity a production; two entities a process between them; into a gate a logic arc (from an entity,
    // or a gate into a gate), out of a gate a stimulation (to a process or a phenotype), out of an equivalence a logic
    // arc to its entity; an entity to a phenotype a modulation. A modulation guessed is the one most used on the map for
    // that kind of end (usual), on a map with none a catalysis onto a process that consumes a simple chemical (a metabolic
    // step), else a stimulation
    // An arc's sign kept in hand (a double click) draws forgivingly: the kind picked where it fits the two ends, else the
    // kind the ends give (no kind picked), silently; never a process made between two entities for a modulation picked
    // (that would say one is turned into the other); a catalysis that fits neither way a stimulation where one fits (an
    // activation: two entities in reduced notation, Activity Flow). A sign taken for one line (a click) makes that kind
    // or nothing
    function linkHow(a, b, P) {
      if (shared.cd) return cdHow(a, b, P);   // a CellDesigner map's (cdcreate.js), with where its end lands
      var want = arcTool(), h = linkKind(a, b, P, want), g;
      if (h && h.no && want && tool.sticky && (g = linkKind(a, b, P, null)) && !g.no && !(g.pair && MODK[want])) return g;
      if (h && h.no && want === 'catalysis' && tool.sticky && (g = linkKind(a, b, P, 'stimulation')) && !g.no) return g;
      return h;
    }
    // Settings' Proposed tick box Demerging links from logic gates: an AND or OR gate may have several lines out (never a NOT
    // gate, a delay or an equivalence)
    function fans(g) {
      if (!V.fanout || sbgnStrict() || nodes2[g].eq) return false;   // Strict SBGN: the specification's one line out
      var l = nodes2[g].el.getElementsByTagNameNS(Y, 'NodeLabel')[0], w = l ? l.textContent.trim().toUpperCase() : '';
      return w === 'AND' || w === 'OR';
    }
    // ---------- the rules table (notation.js), asked by drawing (linkKind) and dragging (core.js takes) alike ----------
    // A line of class cls from node s to node t is put to the table in the notation's terms: each node's kind (ntKind), the
    // sets the palette has on (ntSets), the table's named checks answered from the map's lines (ntCheck), the line being
    // moved left out (skip). -1 for s or t: the process a line between two entities makes. A node the table has no kind for
    // (a compartment, a member of a complex) is left to the gesture's own test (core.js takes0, linkKind0). CellDesigner
    // maps ask the same table in their own part (cdcreate.js cdSays, cdMoveSays)
    function ntKind(i) {
      if (i < 0) return { kind: 'process', cls: 'process' };
      var r = roleOf(i), sub = nodes2[i].shape.kind === 'Submap' && !nodes2[i].comp;
      if (!r && !sub) return null;
      var l = nodes2[i].el.getElementsByTagNameNS(Y, 'NodeLabel')[0];   // a gate's word as drawn (a made one is not in the file yet)
      return NT.nodeKind('graphml', r === 'proc' ? 'Process' : nodes2[i].shape.kind, l ? l.textContent.trim() : '');
    }
    function ntSets() { return (palLangNow() === 'af' ? ['af'] : hybOn() ? ['pd', 'reduced'] : ['pd']).concat(V.fanout ? ['fanout'] : [], sbgnStrict() ? ['strict'] : []); }
    var revMemo;   // a process's reversibility, read once per map text: a drag asks it on every pointer move
    function reversibleNow(id) {
      if (!revMemo || revMemo.t !== shared.text) revMemo = { t: shared.text, r: {} };
      if (!(id in revMemo.r)) revMemo.r[id] = sbJs.reversibility(shared.text, id, { sbgn: src() });
      return revMemo.r[id];
    }
    function ntCheck(cls, s, t, skip) {
      var plain = NT.arcHead('graphml', cls) === 'none', same = function (q) { return plain ? q.arr[1] === 'none' : NT.arcKind('graphml', q.arr[1]) === cls; };   // by kind: crows_foot_one and t_shape are both an inhibition
      var lines = function (f) { return edges2.filter(function (q, j) { return j !== skip && f(q); }).length; };
      return function (c) {
        if (c === 'gateOneOut') return lines(function (q) { return q.s === s; }) ? 'A logic gate has one line out, and this one has it.' : null;
        if (c === 'oneInput') return lines(function (q) { return q.t === t; }) ? 'This gate has one input, and it has it.' : null;
        if (c === 'already') return s >= 0 && t >= 0 && lines(function (q) { return same(q) && ((q.s === s && q.t === t) || (plain && q.s === t && q.t === s)); }) ? 'This line is there already.' : null;
        if (c === 'tagRoom') { if (s < 0 || t < 0) return null; var tg = roleOf(s) === 'tag' ? s : t; return tagRoom(tg, tg === s ? t : s, skip); }
        if (c === 'reversible') { var rv = t >= 0 && reversibleNow(nodes2[t].id); return rv && rv.rev ? 'A reversible process has productions on both sides.' : null; }   // 3.5.2.5
        if (c === 'oneCatalysis' || c === 'oneNecessary') return t >= 0 && lines(function (q) { return q.t === t && same(q); }) ? 'A process has one ' + cls + ' in SBGN (Strict SBGN is ticked in the palette).' : null;
        if (c === 'emptyOne') { var x = cls === 'consumption' ? s : t; return x >= 0 && lines(function (q) { return q.s === x || q.t === x; }) ? 'An empty set has one line in SBGN (Strict SBGN is ticked in the palette).' : null; }
        return null;
      };
    }
    // line k, moved to start at s, is in reduced notation already and keeps its sort of source (an entity or a gate; a
    // phenotype or a submap): onto an entity, or from a phenotype or a submap to no process
    function ntHeld(k, s) {
      var h = k >= 0 ? edges2[k] : null, hs = h && ntKind(h.s), ht = h && ntKind(h.t), ns = h && ntKind(s);
      var pic = function (x) { return x.kind === 'phenotype' || x.kind === 'submap'; };
      return !!(ht && hs && ns) && pic(hs) === pic(ns) && (ht.kind === 'entity' || (pic(hs) && ht.kind !== 'process'));
    }
    function ruleSays(cls, s, t, skip) {
      var ks = ntKind(s), kt = ntKind(t);
      if (skip == null) skip = -1;
      if (!ks || !kt) return null;
      return NT.allowed(cls, ks, kt, { sets: ntSets(), check: ntCheck(cls, s, t, skip), held: ntHeld(skip, s) });
    }
    // the class line k would have with its ends at s and t: a plain line's kind follows its ends (into a process a
    // consumption, with a tag an equivalence arc, else a logic arc)
    function moveCls(k, s, t) {
      var e = edges2[k], kt = ntKind(t);
      if (e.arr[1] !== 'none') return NT.arcKind('graphml', e.arr[1]);
      if ([e.s, e.t, s, t].some(function (x) { return roleOf(x) === 'tag'; })) return 'equivalence arc';
      return NT.arcKind('graphml', 'none', kt ? kt.kind : '') || 'logic arc';
    }
    // an end of line k dragged onto node i (core.js takes, after takes0): the table's answer for the line as it would be,
    // so a drag never makes what drawing does not. A reason, or null
    function moveSays(k, end, i) {
      if (shared.cd) return cdMoveSays(k, end, i);
      var e = edges2[k], s = end ? e.s : i, t = end ? i : e.t;
      if (!ntKind(s) || !ntKind(t)) return 'Not a glyph of the notation.';   // takes0 leaves the kinds to the table: a gate with a word it does not know takes no moved end
      return ruleSays(moveCls(k, s, t), s, t, k);
    }
    function linkKind(a, b, P, want) {   // linkKind0's kind for the gesture, then the table's answer for it
      var r = linkKind0(a, b, P, want), m = r && !r.no && (r.pair ? ruleSays('consumption', a, -1) || ruleSays('production', -1, b) : ruleSays(r.cls, a, b));
      return m ? { no: m } : r;
    }
    function linkKind0(a, b, P, want) {
      if (b < 0) return null;
      var ra = roleOf(a), rb = roleOf(b), eqA = !!nodes2[a].eq, eqB = !!nodes2[b].eq;
      var has = function (s, t, head) { return edges2.some(function (q) { return q.s === s && q.t === t && q.arr[1] === head; }); };
      var ok = function (cls) { return has(a, b, sbJs.ARROW[cls]) ? { no: 'This ' + cls + ' is there already.' } : { cls: cls }; };
      var outs = function (g) { return edges2.filter(function (q) { return q.s === g; }).length; }, ins = function (g) { return edges2.filter(function (q) { return q.t === g; }).length; };
      if (ra === 'tag' || rb === 'tag') {   // a tag (or terminal) and the entity it stands for: an equivalence arc, a plain line (sbgn_edit.connect writes it from the entity)
        var why = 'A tag is joined to an entity by an equivalence arc.';
        if ((ra === 'tag' ? rb : ra) !== 'epn' || (want && want !== 'consumption' && want !== 'logic arc')) return { no: why };
        var room = tagRoom(ra === 'tag' ? a : b, ra === 'tag' ? b : a, -1);
        if (room) return { no: room };
        return has(a, b, 'none') || has(b, a, 'none') ? { no: 'This equivalence arc is there already.' } : { cls: 'equivalence arc' };
      }
      // Reduced notation ticked: a phenotype or a submap starts a modulation as an entity does, and a submap takes one as a
      // phenotype does (CellDesigner has one glyph for phenotype, submap and perturbing agent, with lines both ways);
      // unticked, SBGN PD's rules alone
      // a phenotype, Strict SBGN unticked: a reaction's reactant, modifier or product, as CellDesigner's phenotype is a
      // species (notation.js phenotype-species, phenotype-product); then the entity's rules: on an antenna a consumption
      if (ra === 'pheno' && rb === 'proc' && !sbgnStrict()) ra = 'epn';
      if (ra === 'proc' && rb === 'pheno' && !sbgnStrict() && (!want || want === 'production')) return has(a, b, 'delta') ? { no: 'This production is there already.' } : { cls: 'production' };
      var loose = hybOn(), subA = loose && nodes2[a].shape.kind === 'Submap', subB = loose && nodes2[b].shape.kind === 'Submap';
      if (subB) rb = 'pheno';
      if (!loose && (nodes2[a].shape.kind === 'Submap' || nodes2[b].shape.kind === 'Submap')) return { no: 'A submap is joined to the map by its tags or terminals (Reduced notation is unticked in the palette).' };   // a submap has no role here: no line kind fits it
      if (loose && (ra === 'pheno' || subA)) {
        if ((want && !MODK[want]) || want === 'catalysis') return { no: 'A phenotype or a submap starts a stimulation, inhibition, necessary stimulation or modulation.' };
        if (rb !== 'proc' && rb !== 'pheno' && rb !== 'epn') return { no: 'A line from a phenotype or a submap goes to a process, an entity, a phenotype or a submap.' };
        var u = want || usual(b, 'stimulation');
        return ok(u === 'catalysis' ? 'stimulation' : u);   // the map's usual kind into a process may be catalysis
      }
      if (ra === 'pheno') return { no: sbgnStrict() ? 'Nothing leaves a phenotype in SBGN (Strict SBGN is ticked in the palette).' : 'A line from a phenotype goes into a process (Reduced notation is unticked in the palette).' };
      if (ra === 'gate' && !fans(a) && outs(a)) return { no: 'A logic gate has one line out, and this one has it.' };   // SBGN PD; the converter's rules for the equivalence
      var word = function (i) { var l = nodes2[i].el.getElementsByTagNameNS(Y, 'NodeLabel')[0]; return l ? l.textContent.trim() : ''; };   // a gate's word as drawn (a made one is not in the file yet)
      if (rb === 'gate' && (word(b) === '\u03c4' || word(b).toUpperCase() === 'NOT') && ins(b)) return { no: 'A ' + (word(b) === '\u03c4' ? 'delay' : 'NOT gate') + ' has one input, and this one has it.' };
      var af = palLangNow() === 'af';   // Activity Flow: influences join two activities, and leave a gate for one
      if (af) {
        if (ra === 'epn' && rb === 'epn') return want && !MODK[want] ? { no: 'Activity Flow joins activities by an influence.' } : ok(want || usual(b, 'stimulation'));
        if (ra === 'gate' && !eqA && rb === 'epn') return want && !MODK[want] ? { no: 'A logic gate\u2019s output is an influence.' } : ok(want || usual(b, 'stimulation'));
      } else if (hybOn()) {   // Hybrid: a modulation picked may end on an entity (two entities with no sign still get a process between them)
        if (ra === 'epn' && rb === 'epn' && want && MODK[want]) return want === 'catalysis' ? { no: 'A catalysis ends on a process.' } : ok(want);
        if (ra === 'gate' && !eqA && rb === 'epn' && (!want || MODK[want])) return want === 'catalysis' ? { no: 'A catalysis ends on a process.' } : ok(want || usual(b, 'stimulation'));
      }
      if (want === 'logic arc' && rb !== 'gate' && !(eqA && rb === 'epn')) return { no: 'A logic arc goes into a logic gate.' };
      if (want && MODK[want]) {   // a modulation picked: from an entity or a gate to a process or a phenotype
        if ((ra === 'epn' || (ra === 'gate' && !eqA)) && (rb === 'proc' || rb === 'pheno')) return ok(want);
        return { no: 'A ' + want + ' goes from an entity or a logic gate to a process or a phenotype' + ((ra === 'epn' || ra === 'gate') && rb === 'epn' && palLangNow() === 'pd' && !hybOn() ? ' (Reduced notation is unticked in the palette).' : '.') };
      }
      if (rb === 'gate') {   // a logic arc in: from an entity, or from a gate into a gate (never into or out of an equivalence)
        if (want === 'production') return { no: 'A production goes from a process to an entity.' };
        if (ra === 'proc') return { no: 'A process does not go into a logic gate: the gate’s output goes to the process.' };
        if (ra === 'gate' && (eqA || eqB)) return { no: 'An equivalence joins entities only.' };
        return ok('logic arc');
      }
      if (ra === 'gate') {   // a gate's output
        if ((want === 'logic arc' || want === 'consumption') && eqA) return rb === 'epn' ? ok('logic arc') : { no: 'An equivalence\u2019s line goes to an entity.' };
        if (want) return { no: 'A ' + want + ' does not leave a logic gate: its output is a modulation (a stimulation, unless another is picked).' };
        if (eqA) return rb === 'epn' ? ok('logic arc') : { no: 'An equivalence’s line goes to an entity.' };
        return rb === 'epn' ? { no: 'A logic gate’s output goes to a process, a phenotype or another gate (Reduced notation is unticked in the palette).' } : ok(usual(b, 'stimulation'));
      }
      if (rb === 'pheno') {
        if (ra !== 'epn' || want) return { no: 'A phenotype is modulated by an entity or a logic gate (a stimulation, unless another modulation is picked).' };
        return ok(usual(b, 'stimulation'));
      }
      if (ra === 'proc' && rb === 'proc') return { no: 'An arc goes from an entity into a process (a consumption) or from a process to an entity (a production), not between two processes.' };
      // two entities (a shortcut): a process made between them, with Consumption or Production picked
      if (ra === 'epn' && rb === 'epn') return !want || want === 'consumption' || want === 'production' ? { pair: true } : { no: 'A ' + want + ' does not join two entities. A process is made between them with Consumption or Production picked.' };
      var cls = ra === 'epn' ? 'consumption' : 'production';
      if (want && want !== cls) return { no: want === 'consumption' ? 'A consumption goes from an entity into a process.' : 'A production goes from a process to an entity.' };
      if (!want && cls === 'consumption' && P && offAxis(b, P)) {   // landed on a side off the antennas: a modulation
        var n = nodes2[a], sub = edges2.some(function (q) { return q.t === b && q.arr[1] === 'none' && nodes2[q.s].shape.kind === 'SimpleChemical'; });
        return ok(usual(b, sub && (/^(Macromolecule|Complex)$/.test(n.shape.kind) || n.kids.length > 0) ? 'catalysis' : 'stimulation'));
      }
      if (has(a, b, cls === 'production' ? 'delta' : 'none')) return { no: 'This ' + cls + ' is there already.' };
      return { cls: cls };
    }
    // Drawing and dragging asked the same question (tests/rules-agree.js): for every line of the map, each of its ends put
    // on every other node, whether dragging takes it (core.js takes) and what drawing that line's kind between the same
    // two nodes gives (linkKind: its class, 'pair', or the reason), beside the rules table's answer (notation.js allowed)
    // for each: for the drag the moved line itself left out of the counts, for drawing a new line every line counted.
    // o: { lang: 'pd' or 'af', strict: Reduced notation unticked, sbgn: Strict SBGN ticked }, set for the asking only. One row per distinct question,
    // the nodes named by their notation kinds. Only where the SBGN palette is (palOn).
    function askAll(o) {
      if (!palOn()) return null;   // an SBGN or GraphML map in full editing
      var keep = palSet, rows = {};
      palSet = { lang: o && o.lang || 'pd', look: palSet.look, strict: !!(o && o.strict), sbgn: !!(o && o.sbgn) };
      try {
        var kindOf = ntKind, name = function (k) { return k.kind + ':' + k.cls; }, sets = ntSets();
        edges2.forEach(function (e, k) {
          var a = e.arr[1];
          if (a !== 'none' && !NT.arcKind('graphml', a)) return;
          [0, 1].forEach(function (end) {
            nodes2.forEach(function (n, i) {
              if (i === e.s || i === e.t) return;
              var s = end ? e.s : i, t = end ? i : e.t, ks = kindOf(s), kt = kindOf(t);
              if (!ks || !kt) return;
              var c = moveCls(k, s, t);
              var was = a !== 'none' ? c : NT.arcKind('graphml', 'none', kindOf(e.t) ? kindOf(e.t).kind : '') || 'logic arc';
              var key = [was, end, name(ks), name(kt), name(kindOf(e.s) || { kind: '?' }), name(kindOf(e.t) || { kind: '?' })].join('|');
              if (rows[key]) return;
              var want = c === 'equivalence arc' && (ks.kind === 'tag' || kt.kind === 'tag') ? 'consumption' : c, h = linkKind(s, t, null, want);   // a tag's line is drawn with the plain line's sign
              rows[key] = { arc: was, now: c, end: end ? 'target' : 'source', from: name(ks), to: name(kt), line: name(kindOf(e.s) || { kind: '?' }) + ' > ' + name(kindOf(e.t) || { kind: '?' }),
                            drag: !!takes(k, end, i), draw: !h ? 'nothing' : h.no ? h.no : h.pair ? 'pair' : h.cls,
                            tableDrag: NT.allowed(c, ks, kt, { sets: sets, check: ntCheck(c, s, t, k), held: ntHeld(k, s) }),
                            tableDraw: NT.allowed(c, ks, kt, { sets: sets, check: ntCheck(c, s, t, -1) }) };
            });
          });
        });
      } finally { palSet = keep; }
      return Object.keys(rows).map(function (k) { return rows[k]; });
    }
    function __run61() {   // run at start, in order (__start)
    window.m2EditAsk = askAll;
    }
    // the modulation a line with no kind picked gets: the one most used on the map into nodes of b's role (catalysis only
    // into processes), ties in the palette's order, else `dflt` (a map with none yet)
    function usual(b, dflt) {
      var rb = roleOf(b), kind = {}, n = {}, best = dflt, most = 0;
      Object.keys(MODK).forEach(function (k) { if (k !== 'catalysis' || rb === 'proc') kind[sbJs.ARROW[k]] = k; });
      edges2.forEach(function (q) { var k = kind[q.arr[1]]; if (k && q.t != null && roleOf(q.t) === rb) n[k] = (n[k] || 0) + 1; });
      PAL_PD[4][1].forEach(function (q) { if (n[q[0]] > most) { most = n[q[0]]; best = q[0]; } });
      return best;
    }
    function offAxis(i, P) {   // P on a side off the antennas of process i, one with a consumption or production (a bare one has no axis yet)
      var id = nodes2[i].id, H = window.yrender && hubPorts()[id], b = bx(i), c = [b[0] + b[2] / 2, b[1] + b[3] / 2];
      if (!H || !H[0] || !edges2.some(function (q) { return (q.t === i && q.arr[1] === 'none') || (q.s === i && q.arr[1] === 'delta'); })) return false;
      var hz = Math.abs(H[0][0] - c[0]) >= Math.abs(H[0][1] - c[1]), dx = Math.abs(P[0] - c[0]), dy = Math.abs(P[1] - c[1]);
      return hz ? dy > dx : dx > dy;
    }
    function linkMove(e) {   // the pointer moving with a line begun (core.js)
      if (!link || e.pointerId !== link.pid) return false;
      e.stopImmediatePropagation();
      if ((e.pointerType === 'mouse' && !e.buttons) || link.at !== shared.text) { link = null; shared.tap = null; paint(); return true; }   // its release never came; the map changed under it (undo)
      if (!link.moved && Math.hypot(e.clientX - link.x, e.clientY - link.y) < 5) return true;
      link.moved = true; shared.tap = null;
      link.P = at(e); link.to = linkEnd(link.P, link.from); link.how = linkHow(link.from, link.to, link.P);
      paint();
      return true;
    }
    function linkUp(e) {   // the release (core.js): a line drawn is made; no drag, the click selects as before
      if (!link || e.pointerId !== link.pid) return false;
      var l = link; link = null;
      if (!l.moved) return false;
      e.stopImmediatePropagation(); paint();
      if (e.type !== 'pointerup' || !l.how || l.at !== shared.text) return true;
      if (l.how.no) return true;   // refused (drawn dashed, its target not lit while dragged): nothing made, nothing said
      linkMake(l.from, l.to, l.how);
      if (tool && !tool.sticky) palTake(null);
      return true;
    }
    function linkMake(a, b, how) {
      if (shared.cd) { cdLink(a, b, how); return; }
      var ia = nodes2[a].id, ib = nodes2[b].id, t2 = shared.text, ids = [], o = { sbgn: src(), ant: antNow() };   // ports worked out at the antenna Style gives
      try {
        if (how.cls) { ids.push(freeId('arc_')); t2 = sbJs.connect(t2, ids[0], ia, ib, how.cls, o); }
        else {   // two entities: a process midway on the grid, a consumption from the first, a production to the second
          var A = bx(a), B = bx(b), M = [(A[0] + A[2] / 2 + B[0] + B[2] / 2) / 2, (A[1] + A[3] / 2 + B[1] + B[3] / 2) / 2], D = defOf('process');
          var X = M[0] - D.w / 2, Y2 = M[1] - D.h / 2;
          if (gridSet.snap) { X += toGrid(X + D.w / 2, gridSet.step); Y2 += toGrid(Y2 + D.h / 2, gridSet.step); }
          var c = innermost(M, function (n) { return n.comp; }), pid = freeId('glyph_');
          t2 = sbJs.add(t2, { id: pid, cls: 'process', label: '', box: [+fmt(X), +fmt(Y2), D.w, D.h], parent: c >= 0 ? nodes2[c].id : null });
          ids.push(freeId('arc_')); ids.push(freeId('arc_', ids));
          t2 = sbJs.connect(t2, ids[0], ia, pid, 'consumption', o);
          t2 = sbJs.connect(t2, ids[1], pid, ib, 'production', o);
        }
      } catch (err) { warn('The arc could not be made: ' + (err && err.message || err) + '.'); return; }
      if (sbCols() === 'confetti') ids.forEach(function (id) { t2 = sbJs.recolour(t2, id, confettiLine(confettiHues(t2)).toUpperCase()); });   // a new line a colour of its own, as the map's
      if (t2 === shared.text) return;
      commit(t2, { name: 'arc made', sel: [], selE: ids, quiet: true, then: function () { tagAim([ia, ib]); termsFix(nodes2.map(function (n, k) { return (n.id === ia || n.id === ib) && n.sub != null ? k : -1; }).filter(function (k) { return k >= 0; }));   // a tag's line at its point, a free tag facing it
      } });   // the new arcs selected: Delete takes them back at once
    }
    // where a line being drawn will be attached on node b, shown by the blue square of landMarks (as a CellDesigner map's
    // landing, and an end dragged): an entity's centre; a process's or gate's port in for what goes into it (its antenna
    // tip); a modulation at a process the middle of the side facing its source, off the antennas (sbgn_edit.connect)
    function linkLand(a, b, cls) {
      var B = bx(b), c = [B[0] + B[2] / 2, B[1] + B[3] / 2], r = roleOf(b), H = r && /^(proc|gate)$/.test(r) && window.yrender && hubPorts()[nodes2[b].id];
      if (!r || !/^(proc|gate)$/.test(r)) return c;
      if ((cls === 'consumption' || cls === 'logic arc') && H && H[0]) return H[0];
      if (!cls || !MODS.test(sbJs.ARROW[cls]) || r !== 'proc') return c;
      var A = bx(a), dx = A[0] + A[2] / 2 - c[0], dy = A[1] + A[3] / 2 - c[1];
      var vert = H && H[0] ? Math.abs(H[0][0] - c[0]) >= Math.abs(H[0][1] - c[1]) : Math.abs(dy) > Math.abs(dx);   // on the top or bottom side
      return vert ? [c[0], c[1] + (dy >= 0 ? 1 : -1) * B[3] / 2] : [c[0] + (dx >= 0 ? 1 : -1) * B[2] / 2, c[1]];
    }
    function linkPaint(out) {   // the line being drawn (paint, core.js): from its node's centre to the pointer, where it would be attached marked
      cdGateMarks(out); cdOverMarks(out);   // a CellDesigner gate's inputs clicked so far, Add product's join under the pointer (cdcreate.js)
      if (!link || !link.moved || link.at !== shared.text) return;
      var A = bx(link.from), C = [A[0] + A[2] / 2, A[1] + A[3] / 2], no = !!(link.how && link.how.no);
      // drawn behind its nodes, as the line after the drop: from where it leaves its node's shape outline, none while the
      // pointer is still inside it, and over a node that would take it up to where it meets that node's outline
      var P = link.P, inFrom = inRim(rimOf(link.from, A), [P[0] - C[0], P[1] - C[1]]), S = inFrom ? null : cutShape(link.from, C, P, A);
      if (S && link.to >= 0 && link.to !== link.from) P = cutShape(link.to, P, S, bx(link.to));
      var E = shared.cd && S ? cdLiveEnds(S, P, C) : null;   // an added reactant's or product's join (cdcreate.js)
      if (E) { S = E[0]; P = E[1]; }
      if (shared.cd) cdLinkMarks(out);   // CellDesigner's marks (cdcreate.js)
      else if (link.how && !no && link.to >= 0) out.push(landMarks([], linkLand(link.from, link.to, link.how.cls)));
      if (S) out.push('<path class="m2-ed-live" stroke-width="' + f1(Math.max(1, V.z)) + '"' + (no ? ' stroke-dasharray="4 3"' : '') + ' d="M' + f1(sx(S[0])) + ' ' + f1(sy(S[1])) + 'L' + f1(sx(P[0])) + ' ' + f1(sy(P[1])) + '"/>');
    }
    function __run42() {   // run at start, in order (__start)
    document.addEventListener('keydown', function (e) { if (link && e.key === 'Escape') { link = null; shared.tap = null; paint(); } }, true);
    }

    // ---------- resizing and Properties ----------
    // A glyph selected (a complex's member too, its complex growing round it; a complex with members held round them,
    // roomy in core.js) is resized by its eight handles: the sides dragged move, its width and
    // height in multiples of Grid size (8 by default, so a drag gives regular sizes),
    // Alt or Ctrl held for any size (sized, core.js). Properties, under the palette, shows the width and the height of the
    // one selected, typed for an exact size (its centre kept); Grid size beside the Grid and Snap switches (core.js), kept in this browser with them.
    // sbgn_edit.resize writes the box, its name kept centred, its state variables at their places on the border; write()
    // scales what the SBGN-ML glyph carries the same way.
    // Resizing and Properties serve every format with a palette through its part's answers (propFmt: PF_SB here, PF_CD in
    // cdcreate.js): which node they are for, which rows apply, its look, a field set, a size set
    function propFmt() { return palOn() ? PF_SB : cdPal() ? PF_CD : null; }
    function sizable(i) {   // a complex holding members on every format with a part (held round them: roomy, core.js), not in AF's SBGN view (its members not drawn); else the part's answer
      var f = propFmt(), n = nodes2[i];
      if (!f || !n) return false;
      return n.shape.kind === 'Complex' && n.kids.length ? !shared.afSbgn : f.sizable(i);
    }
    function setSize(i, nb) { setSizes([[i, nb]]); }
    function setSizes(pairs) {   // [[node, box], ...]: one undo step for them all (Properties with several nodes selected)
      var f = propFmt(); if (f) f.size(pairs.map(function (q) { return [q[0], q[1].map(function (v) { return +fmt(v); })]; }));
    }
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
          var b = boxOf(k), rx = b0[2] ? (b[0] + b[2] / 2 - b0[0]) / b0[2] : 0.5, ry = b0[3] ? (b[1] + b[3] / 2 - b0[1]) / b0[3] : 0.5;   // its place scaled with the box
          t2 = sbJs.resize(t2, n.id, [b1[0] + rx * b1[2] - b[2] / 2, b1[1] + ry * b1[3] - b[3] / 2, b[2], b[3]]);
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
    // Properties as yEd's Properties View (familiar from the graph editor, compact): two columns, the name on the left;
    // with Newt's fields the atlas maps keep (label, width, height, border and
    // fill colour, border width, so a map may be as colourful as its curator wants, multimer, Set as
    // default; state variables and units of information have their own ways on the map, Cloned skipped). A field is
    // applied on Enter or when it is left (Esc puts it back), a colour also when the picker closes; one undo step each.
    // Shown for any glyph selected that sbgn_edit restyles (LOOKS), its rows by its class (sbOff); Width and Height for a
    // member of a complex too (Pack keeps member sizes), a process or gate too (its antennas kept: sbgn_edit.fit), a holder's typed as
    // its handles resize it (holderSize). Grid size is beside the Grid and Snap switches (core.js)
    var ROWS, props, EROWS, RROWS;
    function __run43() {   // run at start, in order (__start)
    ROWS = [['label', 'Label', 'text'], ['font', 'Font size', 'num', ' min="1" max="200"', 'The name\u2019s size'], ['w', 'Width', 'num'], ['h', 'Height', 'num'], ['fill', 'Fill colour', 'colour'],
      ['line', 'Border colour', 'colour'], ['width', 'Border width', 'num'], ['multimer', 'Multimer', 'check']];
    // a row: [key, name, kind (text, num, colour, check), its input's limits, its title]; a format's part may add its own rows (propRows)
    props = document.createElement('div');
    props.className = 'm2-ed-props'; props.hidden = true;
    // a line's rows (yEd's Properties View for an edge): its colour and width, its two ports as offsets from its glyph's centre
    // and a consumption's or production's Cardinality (SBGN's, CellDesigner's stoichiometry; empty: 1, none shown)
    // (a text field: a file's ? is shown as it is; typed, a number above 0 up to 1000; empty shows the default 1 in grey,
    // which the file holds by writing nothing)
    EROWS = [['ecol', 'Line colour', 'colour'], ['ewid', 'Line width', 'num', ' min="0.25" max="20"'], ['sx', 'Source port X', 'num'], ['sy', 'Source port Y', 'num'],
      ['tx', 'Target port X', 'num'], ['ty', 'Target port Y', 'num'], ['card', 'Cardinality', 'card']]   // Cardinality last;
    // a reaction's rows, one reaction selected on a map whose format's part has a reaction's answers (PF_CD.rx)
    RROWS = [['rev', 'Reversible', 'check']];
    }
    function table(rows, cls) { return '<table class="m2-ed-ptab' + cls + '">' + rows.map(function (r) {
      var id = 'm2-ed-' + r[0], f = r[2] === 'check' ? '<input type="checkbox" id="' + id + '">'
        : r[2] === 'select' ? '<select id="' + id + '">' + r[3].map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('') + '</select>'
        : r[2] === 'colour' ? '<span class="m2-ed-pc"><input type="color" tabindex="-1" aria-label="' + r[1] + ', picker"><input type="text" id="' + id + '" spellcheck="false" autocomplete="off"' + (r[0] === 'fill' ? ' placeholder="none"' : '') + '></span>'
        : r[2] === 'num' ? '<input type="number" id="' + id + '" step="any"' + (r[3] || (r[0] === 'width' ? ' min="0.25" max="20"' : /^[st][xy]$/.test(r[0]) ? '' : ' min="1" max="5000"')) + '>'
        : r[2] === 'card' ? '<input type="text" inputmode="decimal" class="m2-ed-card" id="' + id + '" placeholder="1" spellcheck="false" autocomplete="off">'
        : '<input type="text" id="' + id + '" spellcheck="false" autocomplete="off">';
      return '<tr data-k="' + r[0] + '"' + (r[4] ? ' title="' + r[4] + '"' : '') + '><th><label for="' + id + '">' + r[1] + '</label></th><td>' + f + '</td></tr>';
    }).join('') + '</table>'; }
    var inW, inH, field, pNow;
    function __run44() {   // run at start, in order (__start)
    props.innerHTML = '<p>Properties</p>' + table(ROWS, ' m2-ed-pnode') + table(EROWS, ' m2-ed-pedge') + table(RROWS, ' m2-ed-prx') + '<table class="m2-ed-ptab m2-ed-pcard" hidden></table>' +
      '<button type="button" class="m2-ed-pdef" title="The next ones of this kind made from the palette take these">Set as default</button>' +
      '<button type="button" class="m2-ed-pall" title="Every glyph of this kind on the map (every process, or every logic gate) takes this one\u2019s size and antenna">Apply to all of this kind</button>' +
      '<button type="button" class="m2-ed-pstd" title="The standard size and antenna of processes and logic gates, at the map\u2019s scale (Style, Standard sizes)">Standard size</button>';
    pal.insertAdjacentElement('afterend', props);
    props.insertAdjacentElement('afterend', pmap);
    inW = props.querySelector('#m2-ed-w'), inH = props.querySelector('#m2-ed-h');
    field = function (k) { return props.querySelector('#m2-ed-' + k); }, pNow = {};
    }
    function propNode() {   // the one node selected that Properties is for (propFmt's node), else -1
      var f = propFmt();
      return !f || shared.selN.length !== 1 || shared.selP.length || shared.selE.length || shared.svSel ? -1 : f.node(shared.selN[0]);
    }
    // the nodes selected that Properties is for (no line or other item selected with them): one alone, or of several
    // those it covers (a CellDesigner complex's member, which it does not, left out); [] else
    function propNodes() {
      var f = propFmt();
      if (!f || !shared.selN.length || shared.selP.length || shared.selE.length || shared.svSel) return [];
      var a = shared.selN.map(function (i) { return f.node(i); });
      return shared.selN.length === 1 ? (a[0] >= 0 ? a : []) : a.filter(function (i) { return i >= 0; });
    }
    function sbNode(i) {   // a glyph Properties restyles (sbgn_edit LOOKS: entities, complexes, compartments, processes, gates, tags and terminals; its class read from the file once per selection and change)
      return sbJs.LOOKS.test(sbClasses()[nodes2[i].id] || '') ? i : -1;
    }
    var TAGS;
    function __run45() {   // run at start, in order (__start)
    TAGS = /^(tag|terminal)$/;
    }   // a tag's rows: Label, Width, Height, Fill colour, Border colour, Border width, Orientation (a terminal's shown, set by its side)
    // the rows a glyph has by its class: Label where sbgn_edit keeps a name (NAMED), Multimer where it writes one (MULTI); Set as default for the kinds the palette makes in a kept look
    function sbOff(k, i) {
      var c = sbClasses()[nodes2[i].id] || '';
      if (k === 'way') return !TAGS.test(c);
      if (TAGS.test(c)) return !/^(label|w|h|fill|line|width)$/.test(k);
      if (k === 'label' || k === 'font') return !sbJs.NAMED.test(c);   // a font size where there is a name
      if (k === 'multimer') return !sbJs.MULTI.test(c.replace(/ multimer$/, ''));
      if (k === 'ant') return !hubGroup(i) || sbAnts()[nodes2[i].id] == null;   // a process's or gate's antenna, once it has ports
      if (EXTRA.indexOf(k) >= 0) return true;   // another format's own rows (propRows)
      if (k === 'def') return !/^(macromolecule|simple chemical)( multimer)?$|^biological activity$/.test(c) && !hubGroup(i);
      return false;
    }
    // every glyph's class in the SBGN-ML file as written now, read once per change of the editor's text (src() writes the file)
    var sbClsMemo;
    function __run46() {   // run at start, in order (__start)
    sbClsMemo = [null, {}];
    }
    function sbClasses() {
      if (sbClsMemo[0] !== shared.text) {
        var m = {}, d = new DOMParser().parseFromString(src(), 'application/xml');
        Array.prototype.forEach.call(d.getElementsByTagNameNS('*', 'glyph'), function (g) { if (g.getAttribute('id')) m[g.getAttribute('id')] = g.getAttribute('class') || ''; });
        sbClsMemo = [shared.text, m];
      }
      return sbClsMemo[1];
    }
    function lookKey(cls, unit) { return cls === 'biological activity' ? cls + ':' + (unit || '') : cls; }   // Set as default's kind: the glyph's class, an activity's by its unit
    function kindOf(i) {
      var c = (sbClasses()[nodes2[i].id] || '').replace(/ multimer$/, '');
      if (c === 'biological activity') return lookKey(c, sbJs.activities(shared.text)[nodes2[i].id]);
      return c || (nodes2[i].shape.kind === 'SimpleChemical' ? 'simple chemical' : 'macromolecule');
    }
    function propsShow(all) {   // all: every field shown again, the one focused too (Esc)
      var i = propNode(), k = propEdge(), r2 = function (v) { return String(Math.round(v * 100) / 100); }, ns = propNodes();
      props.querySelector('.m2-ed-prx').hidden = true; pcard.hidden = true;
      if (ns.length > 1 || (ns.length && shared.selN.length > 1)) return propsMany(ns, all, r2);
      var rx = propRx();
      if (rx && !propFmt().rx.withNode) {   // one reaction: its Reversible tick box alone (a CellDesigner reaction; an SBGN-ML process shows it under its own rows, below)
        props.hidden = false;
        ['.m2-ed-pnode', '.m2-ed-pedge', '.m2-ed-pdef', '.m2-ed-pall', '.m2-ed-pstd'].forEach(function (c) { props.querySelector(c).hidden = true; });
        props.querySelector('.m2-ed-prx').hidden = false;
        var fr = field('rev');
        if (all || document.activeElement !== fr) fr.checked = rx.on;
        rxCounts(rx, all);
        var rk = lineOfRx();   // and its Line colour, the whole reaction's
        if (rk >= 0) { props.querySelector('.m2-ed-pedge').hidden = false; edgeShow(rk, all, r2, true); }
        return;
      }
      Array.prototype.forEach.call(props.querySelectorAll('.m2-mixed'), function (tr) { tr.classList.remove('m2-mixed'); });
      props.querySelector('#m2-ed-multimer').indeterminate = false;
      ROWS.forEach(function (r) { if (r[2] !== 'check') field(r[0]).placeholder = r[0] === 'fill' ? 'none' : ''; });
      props.hidden = i < 0 && k < 0;   // only with its node or line: nothing selected, no Properties
      if (props.hidden) return;
      props.querySelector('.m2-ed-pnode').hidden = i < 0; props.querySelector('.m2-ed-pedge').hidden = i >= 0;
      if (i < 0) { edgeShow(k, all, r2); return; }
      var pf = propFmt(), b = bx(i);
      pNow = pf.look(i);
      if (!pNow) { props.hidden = true; return; }
      Array.prototype.forEach.call(props.querySelectorAll('.m2-ed-pnode tr[data-k]'), function (tr) { tr.hidden = (/^[wh]$/.test(tr.dataset.k) && !sizable(i)) || pf.off(tr.dataset.k, i); });
      props.querySelector('.m2-ed-pdef').hidden = !pf.def || pf.off('def', i);   // the part may keep it from a kind (CellDesigner: species only)
      props.querySelector('.m2-ed-pall').hidden = props.querySelector('.m2-ed-pstd').hidden = !pf.hub || !pf.hub(i);   // a process or gate (the part's answer: SBGN-ML's hubGroup)
      if (rx) { props.querySelector('.m2-ed-prx').hidden = false; var fr2 = field('rev'); if (all || document.activeElement !== fr2) fr2.checked = rx.on; rxCounts(rx, all); }   // an SBGN-ML process: Reversible after its own rows
      pNow.w = r2(b[2]); pNow.h = r2(b[3]); ROWS.forEach(function (r) { if (r[2] === 'num' && pNow[r[0]] != null) pNow[r[0]] = r2(pNow[r[0]]); });
      ROWS.forEach(function (r) {
        var f = field(r[0]);
        if (!all && document.activeElement === f) return;
        if (r[2] === 'check') { f.checked = pNow[r[0]]; return; }
        if (f.value !== pNow[r[0]]) f.value = pNow[r[0]];   // only what changed (it runs with every paint)
        var pk = f.previousElementSibling;
        if (r[2] === 'colour' && document.activeElement !== pk && pk.value !== (pNow[r[0]] || '#ffffff')) pk.value = pNow[r[0]] || '#ffffff';   // not under a choice being made
      });
    }
    // Several nodes selected (Select all of this kind, an area, Shift with clicks): the rows every one has, Label and Set as
    // default never; a row whose value is the same for all shows it, one that differs is an empty grey field
    // (a colour's swatch crossed out, a tick box neither), still editable: a value set goes to all of them in one
    // undo step, Width and Height each keeping its node's centre. Their looks read once per selection and file
    var mLook;
    function __run47() {   // run at start, in order (__start)
    mLook = [null, null, null];
    }   // [nodes, their looks, the file read]
    function propsMany(ns, all, r2) {
      var pf = propFmt(), key = ns.join(','), now = shared.cd ? shared.cd.now : shared.text;
      if (mLook[0] !== key || mLook[2] !== now) mLook = [key, ns.map(function (i) { var L = pf.look(i), b = bx(i); if (L) { L.w = r2(b[2]); L.h = r2(b[3]); ROWS.forEach(function (r) { if (r[2] === 'num' && L[r[0]] != null) L[r[0]] = r2(L[r[0]]); }); } return L; }), now];
      var Ls = mLook[1];
      if (Ls.some(function (L) { return !L; })) { props.hidden = true; return; }
      props.hidden = false;
      props.querySelector('.m2-ed-pnode').hidden = false; props.querySelector('.m2-ed-pedge').hidden = true;
      props.querySelector('.m2-ed-pdef').hidden = props.querySelector('.m2-ed-pall').hidden = true;
      props.querySelector('.m2-ed-pstd').hidden = !pf.hub || !ns.every(pf.hub);   // several processes or gates: Standard size for all of them
      ROWS.forEach(function (r) {
        var tr = props.querySelector('.m2-ed-pnode tr[data-k="' + r[0] + '"]'), f = field(r[0]);
        tr.hidden = r[0] === 'label' || ns.some(function (i, j) { pNow = Ls[j]; return (/^[wh]$/.test(r[0]) && (!sizable(i) || holds(i))) || pf.off(r[0], i); });   // a holder's size alone (holderSize)
        if (tr.hidden || (!all && document.activeElement === f)) return;
        var vs = Ls.map(function (L) { return r[2] === 'check' ? !!L[r[0]] : String(L[r[0]] == null ? '' : L[r[0]]); }), one = vs.every(function (v) { return v === vs[0]; });
        tr.classList.toggle('m2-mixed', !one);
        if (r[2] === 'check') { f.indeterminate = !one; f.checked = one && vs[0]; return; }
        var v = one ? vs[0] : '';
        if (f.value !== v) f.value = v;
        f.placeholder = one && r[0] === 'fill' ? 'none' : '';
        var pk = f.previousElementSibling;
        if (r[2] === 'colour' && one && document.activeElement !== pk) pk.value = v || '#ffffff';
      });
    }
    function __run48() {   // run at start, in order (__start)
    [inW, inH].forEach(function (inp, k) {
      inp.addEventListener('change', function () {
        var ns = propNodes(), v = parseFloat(inp.value);
        if (!ns.length || !ns.every(sizable)) return;
        if (!isFinite(v)) { propsShow(true); return; }
        v = Math.min(Math.max(v, 1), 5000);   // outside 1 to 5000: the nearest, silently (a graph editor's fields; a compartment 30 below)
        var pairs = ns.map(function (i) {
          var b = boxOf(i), w = nodes2[i].comp ? Math.max(v, 30) : v, nb = b.slice(); nb[2 + k] = w; nb[k] = b[k] + b[2 + k] / 2 - w / 2;   // its centre kept; a compartment 30 at least (as its handles: room for its two lines)
          if (holds(i) && !nodes2[i].comp) nb = roomy(i, nb, k ? 'tb' : 'lr', b);   // a complex never smaller than its members need, as its handles
          return [i, nb];
        }).filter(function (q) { return Math.abs(q[1][2 + k] - boxOf(q[0])[2 + k]) >= 0.005; });
        if (!pairs.length) { propsShow(true); return; }
        // a holder (a compartment, a complex with members) as its handles resize it: what it holds kept, let go or taken in
        // (holderSize, core.js); alone, so each its own step
        if (pairs.length === 1 && holds(pairs[0][0])) { var h = pairs[0]; keepSel(function () { holderSize(h[0], h[1].map(function (x) { return +fmt(x); }), boxOf(h[0])); }); return; }
        keepSel(function () { setSizes(pairs); });
      });
    });
    }
    function hex(v) {   // #rgb or #rrggbb, with or without #, as yEd writes it ('' for none, null not a colour)
      v = v.trim().replace(/^#/, '');
      if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/./g, '$&$&');
      return /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toUpperCase() : v ? null : '';
    }
    function propSet(k) {   // the label, its font size, a colour, the border width or multimer, from its field (the format's part writes it), to every node it is for
      var ns = propNodes();
      if (!ns.length) return;
      var f = field(k), v = k === 'multimer' ? f.checked : f.value;
      if (ns.length > 1 && k !== 'multimer' && v === '' && f.closest('tr').classList.contains('m2-mixed')) { propsShow(true); return; }   // left mixed: nothing set
      if (!keepSel(function () { return propFmt().set(k, v, ns); })) propsShow(true);
    }
    function keepSel(f) {   // a change made, the selection as it was (by id) selected again: a value set keeps every node chosen
      var ids = shared.selN.map(function (i) { return nodes2[i].id; }), r = f();
      if (shared.selN.length !== ids.length) { shared.selN = []; nodes2.forEach(function (n, k) { if (ids.indexOf(n.id) >= 0) shared.selN.push(k); }); paint(); }
      return r;
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
    // Properties' Reversible tick box for one SBGN-ML process selected alone, under its own rows (withNode): { rid, on },
    // or null where it can be neither (no production, an association, a gate); read once per process and text, as
    // Properties runs with every paint
    var sbRxSeen;
    function __run49() {   // run at start, in order (__start)
    sbRxSeen = [null, null];
    }
    function sbRxOf() {
      if (shared.selN.length !== 1 || shared.selE.length || shared.selP.length || shared.svSel) return null;
      var id = nodes2[shared.selN[0]] && nodes2[shared.selN[0]].id;
      if (!id || sbJs.PROCESSES.indexOf(sbClasses()[id] || '') < 0) return null;
      var key = id + '\u0000' + shared.text;
      if (sbRxSeen[0] !== key) { var rv = null; try { rv = sbJs.reversibility(shared.text, id, { sbgn: src() }); } catch (e) { rv = null; } sbRxSeen = [key, rv && (rv.can || rv.rev) ? { rid: id, on: rv.rev > 0 } : null]; }
      return sbRxSeen[1];
    }
    var PF_SB, eFor;
    function __run50() {   // run at start, in order (__start)
    PF_SB = { sizable: sbSizable, size: sbSetSize, node: sbNode, set: sbSet, def: sbDef, ends: sbEnds, hub: function (i) { return !!hubGroup(i); },
      rx: { of: sbRxOf, set: function (pid, on) { return sbReversible(pid, on, true); }, withNode: true },
      line: { colour: sbLineColour, set: sbLineSet, width: function (k) { return sbJs.widthOf(sbEdgeEl(k)); }, setWidth: sbLineWidth, ports: true,   // a line's colour, width and its ports' rows (edgeShow, edgeSet)
        count: sbCount, setCount: function (k, v) { return sbLineTo(k, sbJs.recount(shared.text, edges2[k].id, v)); } },   // a consumption's or production's cardinality
      off: sbOff,
      look: function (i) {
        var r = realizerOf(nodes2[i].el), o = sbJs.lookOf(r), wf = field('way');
        if (wf) { wf.disabled = nodes2[i].sub != null; wf.title = wf.disabled ? 'A terminal points into its submap, set by the side it sits on' : ''; }
        var an = hubGroup(i) ? sbAnts()[nodes2[i].id] : null;   // read only for a process or gate (every antenna in one reading of the text)
        return { label: nameOf(i), font: o.font, fill: o.fill ? o.fill.slice(0, 7).toLowerCase() : '', line: (o.line || '#000000').slice(0, 7).toLowerCase(), width: o.width, multimer: o.multimer, way: (sbJs.wayOfR && sbJs.wayOfR(r)) || 'right', ant: an == null ? '' : an };
      } };
    // a line's Properties, one line selected on a map whose format's part has a line's answers (PF_SB.line): Line colour
    // and its ports as yEd gives them, offsets from its glyph's centre (sx, sy at the source, tx, ty at the target), set
    // as a dragged end sets them (setPorts). An end at a process's or gate's port goes with it: shown, not typed.
    // A field applies to the line it was typed for (eFor), also when another line was clicked before it was left
    eFor = null;
    }
    function propRx() { var f = propFmt(); return f && f.rx ? f.rx.of() : null; }   // the reaction Properties is for ({ rid, on }), else null
    // a reaction's Cardinality, one row per reactant and product by its name (a whole reaction selected: its main line
    // selects all of it), where its part lists them (PF_CD.rx.counts: [{ line, name, value }])
    var pcard, pcardKey;
    function __run51() {   // run at start, in order (__start)
    pcard = props.querySelector('.m2-ed-pcard'), pcardKey = null;
    }
    function rxCounts(rx, all) {
      var c = rx && propFmt().rx.counts ? propFmt().rx.counts(rx.rid) : [];
      pcard.hidden = !c.length;
      if (!c.length) return;
      var key = rx.rid + '\u0000' + c.map(function (p) { return p.line + '\u0001' + p.name; }).join('\u0000');
      if (key !== pcardKey) {
        pcardKey = key;
        pcard.innerHTML = '<tr><th colspan="2">Cardinality</th></tr>' + c.map(function (p) {
          return '<tr><th><label for="m2-ed-pc-' + escAttr(p.line) + '">' + escHtml(p.name) + '</label></th><td><input type="text" inputmode="decimal" class="m2-ed-card" id="m2-ed-pc-' + escAttr(p.line) + '" data-line="' + escAttr(p.line) + '" placeholder="1" spellcheck="false" autocomplete="off"></td></tr>';
        }).join('');
      }
      c.forEach(function (p) { var f = pcard.querySelector('[data-line="' + p.line.replace(/"/g, '\\"') + '"]'); if (f && (all || document.activeElement !== f) && f.value !== p.value) f.value = p.value; });
    }
    function escHtml(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function escAttr(v) { return escHtml(v).replace(/"/g, '&quot;'); }
    function cardOf(f) {   // a Cardinality typed: '' for none (1), a number above 0 in hundredths, null for anything else
      var v = f.value.trim(), n = parseFloat(v);
      return v === '' ? '' : n > 0 && n <= 1000 ? String(Math.round(n * 100) / 100) : null;
    }
    function __run52() {   // run at start, in order (__start)
    pcard.addEventListener('change', function (e) {
      var f = e.target, r = propRx(), pf = propFmt(), v = f.dataset && f.dataset.line ? cardOf(f) : null;
      if (!r || !pf.rx.setCount || v === null || !pf.rx.setCount(r.rid, f.dataset.line, v)) propsShow(true);   // not written: the field shows the file again
    });
    field('rev').addEventListener('change', function (e) {
      e.target.blur();   // the editor's keys (undo) work at once
      var r = propRx();
      if (!r || !propFmt().rx.set(r.rid, e.target.checked)) propsShow(true);   // not written: the box shows the file again
    });
    }
    // a line selected alone that its format's part gives Properties (PF_SB.line, PF_CD.line: a colour it reads, null when
    // it has none of its own)
    function propEdge() {
      var f = propFmt(), k = shared.selE[0];
      return f && f.line && shared.selE.length === 1 && !shared.selN.length && !shared.selP.length && !shared.svSel && edges2[k] && edges2[k].path && f.line.colour(k) != null ? k : -1;
    }
    function lineOfRx() {   // a line of the one reaction selected (Properties' reaction rows) whose colour is the reaction's, else -1
      var r = propRx(), f = propFmt();
      if (!r || !f.line) return -1;
      var k = edges2.findIndex(function (q) { return q.id.indexOf(r.rid + '|') === 0 && !/\|[mrp]\d+$/.test(q.id); });   // not a line with its own colour
      return k >= 0 && f.line.colour(k) != null ? k : -1;
    }
    var sbCountMemo;
    function __run53() {   // run at start, in order (__start)
    sbCountMemo = [null, null, null];
    }   // [line id, text, its cardinality]: read once per line and text (Properties runs with every paint)
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
    function atHub(k, end) { var e = edges2[k], n = end ? e.t : e.s; return n == null || !!nodes2[n].hub; }
    function edgeShow(k, all, r2, rxLine) {   // rxLine: the line of a whole reaction selected (its colour, not one participant's number)
      props.querySelector('.m2-ed-pdef').hidden = props.querySelector('.m2-ed-pall').hidden = props.querySelector('.m2-ed-pstd').hidden = true;
      var e = edges2[k], pl = propFmt().line, card = !rxLine && pl.count ? pl.count(k) : undefined;
      var now = { ecol: (pl.colour(k) || '#000000').slice(0, 7).toLowerCase(), ewid: r2(pl.width(k)), card: card || '' };
      ['sx', 'sy', 'tx', 'ty'].forEach(function (a) { now[a] = r2(num(e.path, a) || 0); });
      EROWS.forEach(function (r) {
        var f = field(r[0]);
        var port = /^[st][xy]$/.test(r[0]);
        f.closest('tr').hidden = (port && !pl.ports) || (r[0] === 'card' && card === undefined);   // the ports as offsets: yEd's, not every format's; a number only on a consumption or production
        if (port) f.disabled = atHub(k, r[0].charAt(0) === 't');
        if (!all && document.activeElement === f) return;
        if (f.value !== now[r[0]]) f.value = now[r[0]];
        var pk = f.previousElementSibling;
        if (r[2] === 'colour' && document.activeElement !== pk && pk.value !== now.ecol) pk.value = now.ecol;
      });
    }
    function edgeSet(key) {   // one undo step; a field left unchanged or not a number puts the value back
      var f = field(key), k = edges2.findIndex(function (q) { return q.id === eFor; }), pf = propFmt();
      if (k < 0 || !pf || !pf.line) return;
      var e = edges2[k];
      if (key === 'ecol') {
        var c = hex(f.value);
        if (c === null) { propsShow(true); return; }
        if (!pf.line.set(k, c === '' || c === '#000000' ? null : c)) propsShow(true);
        return;
      }
      if (key === 'card') {   // empty or 1: none; not a number above 0: the field shows the file again
        var v = cardOf(f);
        if (v === null || !pf.line.setCount || !pf.line.setCount(k, v)) propsShow(true);
        return;
      }
      if (key === 'ewid') {   // outside 0.25 to 20: the nearest, silently (as Border width)
        var w = parseFloat(f.value);
        if (!isFinite(w) || !pf.line.setWidth(k, Math.round(Math.min(Math.max(w, 0.25), 20) * 100) / 100)) propsShow(true);   // in hundredths, as shown and written
        return;
      }
      var end = key.charAt(0) === 't', v = parseFloat(f.value), a = end ? ['tx', 'ty'] : ['sx', 'sy'];
      if (atHub(k, end) || !(Math.abs(v) <= 5000)) { propsShow(true); return; }
      var to = a.map(function (q) { return q === key ? v : num(e.path, q) || 0; });
      setPort({ k: k, end: end, n: end ? e.t : e.s, to: to });
    }
    function __run54() {   // run at start, in order (__start)
    EROWS.forEach(function (r) {
      var f = field(r[0]);
      [f, f.previousElementSibling].filter(Boolean).forEach(function (x) { x.addEventListener('focus', function () { var k = propEdge(); if (k < 0) k = lineOfRx(); eFor = k < 0 ? null : edges2[k].id; }); });
      f.addEventListener('change', function () { edgeSet(r[0]); });
      if (r[2] === 'colour') f.previousElementSibling.addEventListener('change', function (e) { f.value = e.target.value; edgeSet(r[0]); });
    });
    }
    function propListen(r) {
      if (/^[wh]$/.test(r[0])) return;   // Width and Height: above
      var f = field(r[0]);
      f.addEventListener('change', function () { propSet(r[0]); });
      if (r[2] === 'colour') f.previousElementSibling.addEventListener('change', function (e) { f.value = e.target.value; propSet(r[0]); });
    }
    var EXTRA;
    function __run55() {   // run at start, in order (__start)
    ROWS.forEach(propListen);
    // a format's part adds rows of its own after Border width, each call after the rows added before (its off() hides them where they do not apply; other parts' off() by EXTRA)
    EXTRA = [];
    }
    function propRows(rows) {
      var last = EXTRA.length ? EXTRA[EXTRA.length - 1] : 'width', at = props.querySelector('.m2-ed-pnode tr[data-k="' + last + '"]'), tmp = document.createElement('div');   // after the rows added before
      tmp.innerHTML = table(rows, '');
      Array.prototype.slice.call(tmp.querySelectorAll('tr')).reverse().forEach(function (tr) { at.insertAdjacentElement('afterend', tr); });
      var k = ROWS.findIndex(function (r) { return r[0] === last; });
      rows.forEach(function (r, j) { ROWS.splice(k + 1 + j, 0, r); EXTRA.push(r[0]); propListen(r); });
    }
    var DEF_KEY;
    function __run56() {   // run at start, in order (__start)
    propRows([['way', 'Orientation', 'select', ['right', 'left', 'up', 'down']]]);   // a tag's (sbOff)
    propRows([['ant', 'Antenna', 'num', ' min="1" max="200"', 'The stick from a process or logic gate to its port, in px from its side']]);   // a process's or gate's (sbOff)
    props.addEventListener('keydown', function (e) {   // Enter keeps the value, Esc takes it back; the map's keys stay out of the fields
      if (e.key === 'Enter') { e.target.blur(); e.preventDefault(); }
      else if (e.key === 'Escape') { propsShow(true); e.target.blur(); e.preventDefault(); }   // the value put back first, so leaving the field changes nothing
      e.stopPropagation();
    });
    // Set as default (Newt's): this node's size, colours, border and multimer kept as they are, by kind, in this browser
    // for every map (atlas-edit-defaults), and Style and Colours switched to Custom: Style Custom takes the size and
    // multimer, Colours Custom the fill, border colour and width; a kind with none kept takes From map
    DEF_KEY = 'atlas-edit-defaults';
    }
    function looksKept(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; } }   // the looks kept by Set as default, by kind (a format's own key)
    function defsKept() { return looksKept(DEF_KEY); }
    function defOf(cls) {   // the look a new glyph of that kind gets: the map's (sbgn_edit.defaults), or the one set as default
      cls = baseKind(cls);
      var kind0 = cls;
      if (ACT_UNIT[cls] != null) cls = 'biological activity';   // its size by its unit's kind (sbgn_edit.defaults)
      var D = sbJs.defaults(src(), null, cls, ACT_UNIT[kind0]), kept = defsKept(), k = kept[lookKey(cls, ACT_UNIT[kind0])];   // an activity's fill by its unit where the map has none (sbgn_edit.fillFor)
      D.multimer = false;
      // on an Activity Flow map a plain entity is saved as its activity: its fill as the map's activities of that kind
      // (CaMKII: a protein placed from the PD palette white as its unfilled protein activities, not the Default blue)
      var u = cls !== 'biological activity' && palKind() === 'af' ? sbJs.unitFor(kind0) : null;
      if (u != null) { k = kept[lookKey('biological activity', u)]; var DA = sbJs.defaults(src(), null, 'biological activity', u); D.fill = DA.fill; D.fallback = DA.fallback; if (DA.w !== DA.w0 || DA.h !== DA.h0) { D.w = DA.w; D.h = DA.h; } }   // and its size, where the map's activities of that kind share one
      if (k && !(k.w > 0)) k = null;   // a look kept before sizes were kept as they are
      var st = palStyle(), cm = sbCols();
      if (st === 'default') { D.w = D.w0; D.h = D.h0; }   // Style: Default, the built-in sizes (at the map's scale)
      else if (st === 'custom' && k) {
        if (k.w > 0 && k.h > 0) { D.w = k.w; D.h = k.h; }
        if ('multimer' in k) D.multimer = k.multimer;
        if (k.font > 0) D.font = k.font;   // its name's size with the size
      }
      var kc = cm === 'custom' && !!k;   // Colours: Custom, the look kept
      if (kc) ['fill', 'line', 'width'].forEach(function (q) { if (q in k) D[q] = k[q]; });
      else if (cm === 'default') { D.fill = sbJs.fillFor(u != null ? 'biological activity' : cls, u != null ? u : ACT_UNIT[kind0]); D.line = null; D.fallback = true; }
      else if (cm === 'none') { D.fill = null; D.line = null; D.fallback = false; }
      else if (cm === 'confetti' && cls !== 'compartment' && sbJs.fillFor(u != null ? 'biological activity' : cls, u != null ? u : ACT_UNIT[kind0])) { D.fill = confettiFill(src()); D.line = null; D.fallback = false; }   // entities only: FILL has none for processes, gates and empty sets
      // a metabolite's activity is placed square, as tall as the others, in either view (in the reduced
      // notation view a circle 40 by 40, not an 80 by 40 stadium; in the SBGN view a square, its palette sign
      // still a rectangle)
      if (kind0 === 'metabolite activity') D.w = D.h;
      return D;
    }
    // Set as default asks the format's part (propFmt().def: sbDef here, cdDef in cdcreate.js), which keeps the look and
    // switches its rows to Custom
    function __run57() {   // run at start, in order (__start)
    props.querySelector('.m2-ed-pdef').addEventListener('click', function () {
      var i = propNode(), pf = propFmt();
      if (i >= 0 && pf.def) palDid([DEF_KEY, CD_DEF_KEY, CHOICE_KEY], function () { pf.def(i); });
    });
    }
    function keepLook(key, all) { try { localStorage.setItem(key, JSON.stringify(all)); return true; } catch (e) { warn('The default could not be kept in this browser.'); return false; } }
    function sbDef(i) {
      var o = sbJs.lookOf(realizerOf(nodes2[i].el)), b = boxOf(i), all = defsKept(), g = hubGroup(i);
      if (g) HUB_KINDS[g].forEach(function (c) { all[c] = { w: b[2], h: b[3], fill: o.fill, line: o.line, width: o.width, ant: sbAnts()[nodes2[i].id] }; });   // every kind drawn alike (a process's three, the gates), the letters left standard
      else all[kindOf(i)] = { w: b[2], h: b[3], fill: o.fill, line: o.line, width: o.width, multimer: o.multimer, font: o.font };   // as it is, no share of another size
      if (!keepLook(DEF_KEY, all)) return;
      keepMapChoice('style', 'custom'); keepMapChoice('cols', 'custom'); styleRow(); sbColsRow();
    }
    // Processes and logic gates as two kinds for sizes and antennas (each drawn alike: Apply to all, Set as default, the
    // antenna of new arcs): hubGroup, the kind of node i ('process', 'gate' or null); sbAnts, every antenna of the map
    // (sbgn_edit.antennas), read once per text
    var HUB_KINDS;
    function __run58() {   // run at start, in order (__start)
    HUB_KINDS = { process: ['process', 'omitted process', 'uncertain process'], gate: ['and', 'or', 'not', 'equivalence', 'delay'] };
    }
    function hubGroup(i) {
      var c = i != null && nodes2[i] ? sbClasses()[nodes2[i].id] || '' : '';
      return HUB_KINDS.process.indexOf(c) >= 0 ? 'process' : HUB_KINDS.gate.indexOf(c) >= 0 ? 'gate' : null;
    }
    var antMemo;
    function __run59() {   // run at start, in order (__start)
    antMemo = [null, {}];
    }
    function sbAnts() { if (antMemo[0] !== shared.text) antMemo = [shared.text, sbJs.antennas(shared.text, { sbgn: src() })]; return antMemo[1]; }
    // the antenna new arcs give a process or gate with no port yet (sbgn_edit.connect's opt.ant), by Style: Standard
    // sizes the standard (sbgn_edit.ANT), Custom the one kept by Set as default, From map (and Custom with none) the one
    // most of that kind have on the map, else the standard
    function antNow() {
      var st = palStyle(), kept = defsKept(), A = sbAnts(), out = {};
      Object.keys(HUB_KINDS).forEach(function (g) {
        var k = kept[HUB_KINDS[g][0]];
        if (st === 'default') { out[g] = sbJs.ANT * stdScale(); return; }
        if (st === 'custom' && k && k.ant != null) { out[g] = k.ant; return; }
        var cnt = {}, top = null;
        nodes2.forEach(function (n, i) { var L = A[n.id]; if (L == null || hubGroup(i) !== g) return; cnt[L] = (cnt[L] || 0) + 1; if (top == null || cnt[L] > cnt[top]) top = L; });
        out[g] = top != null ? +top : sbJs.ANT * stdScale();
      });
      return out;
    }
    // Apply to all of this kind (one process or gate selected): every other of its kind on the map takes its size (each
    // keeping its centre), its antenna and, a gate, its letters' size; Standard size (one or several selected): each
    // takes the standard size, antenna and letters at the map's scale. One undo step each, in one reading of the text
    // (sbgn_edit.fit); the compartments round them grown to hold them, as a resize does
    function stdScale() { var D = sbJs.defaults(src(), null, 'process'); return D.w0 / sbJs.SIZE.process[0]; }   // the map's scale (sbgn_edit.defaults)
    function stdLetters() { return Math.round(sbJs.GATE_FONT * stdScale() * 2) / 2; }
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
    function __run60() {   // run at start, in order (__start)
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

    export function __start() { __run1(); __run2(); __run3(); __run4(); __run5(); __run6(); __run7(); __run8(); __run9(); __run10(); __run11(); __run12(); __run13(); __run14(); __run15(); __run16(); __run17(); __run18(); __run19(); __run20(); __run21(); __run22(); __run23(); __run24(); __run25(); __run26(); __run27(); __run28(); __run29(); __run31(); __run32(); __run33(); __run34(); __run35(); __run36(); __run37(); __run38(); __run39(); __run40(); __run41(); __run42(); __run43(); __run44(); __run45(); __run46(); __run47(); __run48(); __run49(); __run50(); __run51(); __run52(); __run53(); __run54(); __run55(); __run56(); __run57(); __run58(); __run59(); __run60(); __run61(); }   // the part's statements, in their order
    export { ARCS, PAL_KEY, SS, SV, UI, colsPick, confettiFill, confettiHues, confettiLine, confettiOne, confettiPick, confettiSquares, ddOpen, hex, hybOn, iconKeep, iconSpread, innermost, joinDo, joinPack, joinPlan, keepLook, keepMapChoice, link, linkDown, linkEnd, linkMove, linkPaint, linkUp, looksKept, mapCols, moveSays, nameAt, origAll, pNow, pal, palBlocks, palDid, palDown, palDrop, palId, palLangNow, palShow, palSigns, palSignsEl, palStore, palStyle, palTake, palUp, placedAt, propFmt, propRows, sbgnStrict, setSize, sizable, styleRow, svAt, svDelete, svDown, svIcons, svList, svMarks, svParts, textsOf, tool, typeIn };
