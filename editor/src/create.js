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
    var PRESET = { 'nucleic acid feature ct:gene': ['nucleic acid feature', ['ct:gene']], 'nucleic acid feature ct:mRNA': ['nucleic acid feature', ['ct:mRNA']] };
    function baseKind(k) { return PRESET[k] ? PRESET[k][0] : k; }
    var PAL_PD = [   // groups named as SBGN's PD reference card, ordered
      // nodes first, the gates, the arcs last;
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
        ['submap', 'Submap', '<rect x="1.5" y="4" width="21" height="16"/>']]],
      // logic gates (with SBGN's equivalence operator), a
      // circle with its word or sign, made bare as a process, its antennas grown by its arcs; marks inside a sign are class
      // 'in', a dot class 'dot', letters plain <text>: their weight is the Edit window's one rule (atlas-app.html, Sign weights)
      ['Logical operators', [['and', 'AND', '<circle cx="12" cy="12" r="10"/><text x="12" y="14.7" text-anchor="middle" font-size="7.4" letter-spacing="-.1">AND</text>'],
        ['or', 'OR', '<circle cx="12" cy="12" r="10"/><text x="12" y="14.9" text-anchor="middle" font-size="8.2">OR</text>'],
        ['not', 'NOT', '<circle cx="12" cy="12" r="10"/><text x="12" y="14.7" text-anchor="middle" font-size="7.4" letter-spacing="-.1">NOT</text>'],
        ['equivalence', 'Equivalence', '<circle cx="12" cy="12" r="10"/><path d="M7.5 8.8h9M7.5 12h9M7.5 15.2h9" class="in"/>']]],
      // arcs: drawn by a drag from a node with the arc's sign picked
      ['Connecting arcs', [['consumption', 'Consumption / logic arc', '<path d="M3 12h18"/>'],
        ['production', 'Production', '<path d="M3 12h11"/><path d="M13 7.5l8 4.5-8 4.5z" fill="currentColor"/>'],
        // the modulations, by use: catalysis, the most used, first; modulation, the least used, last
        ['catalysis', 'Catalysis', '<path d="M3 12h12"/><circle cx="18" cy="12" r="3"/>'],
        ['stimulation', 'Stimulation', '<path d="M3 12h10"/><path d="M13 7.5l8 4.5-8 4.5z"/>'],
        ['inhibition', 'Inhibition', '<path d="M3 12h17M20 6v12"/>'],
        ['necessary stimulation', 'Necessary stimulation', '<path d="M3 12h10M10 7v10"/><path d="M13 7.5l8 4.5-8 4.5z"/>'],
        ['modulation', 'Modulation', '<path d="M3 12h10"/><path d="M13 12l4-4 4 4-4 4z"/>']]]
    ];
    // Activity Flow (two tabs, PD and AF, and under AF the
    // view, Reduced notation (CellDesigner) or SBGN: one set of rules, two ways of drawing the nodes). A node made in either
    // view is the same glyph in the file: a biological activity whose unit of information holds its entity (none for a
    // protein's; sbgn_edit write), drawn in the SBGN view as the activity (a sharp-cornered rectangle, the unit small at
    // its top right), in the reduced notation view as the entity itself. No processes, no empty set, no consumption or production, no catalysis (AF has
    // none); the four influences of the AF reference card under its names; the delay (tau) added to the gates, the
    // equivalence kept (AF lacks it only because its specification was not updated)
    var PHENO = PAL_PD[1][1].filter(function (q) { return q[0] === 'phenotype'; })[0], OTHER = PAL_PD[2];
    var GATES_PD = PAL_PD[3][1], ARC_PD = {};
    PAL_PD[4][1].forEach(function (q) { ARC_PD[q[0]] = q; });
    var DELAY = ['delay', 'Delay', '<circle cx="12" cy="12" r="10"/><text x="12" y="17" text-anchor="middle" font-size="14" font-family="Times New Roman, serif" fill="currentColor" stroke="none">\u03c4</text>'];
    var INFL = [['stimulation', 'Positive influence'], ['inhibition', 'Negative influence'], ['modulation', 'Unknown influence'], ['necessary stimulation', 'Necessary stimulation']];
    // the activities, all the same size: Activity, a sharp rectangle with no unit (a protein's, as SBGN's AF examples), then one for each
    // entity with its unit at the top right (sbgn_edit.afUnitBox), the protein's twice as wide as high, the metabolite's a
    // circle; the rectangle's top edge left open under the unit, the unit an inner mark (Sign weights). ACT_UNIT: the
    // unit each makes ('' none). The logic arc, the bare line into a gate, its own sign here
    var ACT = ['activity', 'Activity', '<rect x="1.5" y="5" width="21" height="14"/>'];
    var ACT_UNIT = { activity: '' }, ACT_NAME = {};   // the palette's kind -> its unit, and back
    var ACTS = [ACT].concat([['macromolecule', 'Protein activity', '<rect x="10.5" y="2.5" width="10" height="5" rx="1.6"/>', 10.5, 20.5],
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
    var PD_SIGN = {}; PAL_PD[0][1].forEach(function (q) { PD_SIGN[q[0]] = q[2]; });
    PD_SIGN['nucleic acid feature'] = '<path d="M1.5 5h21v9.5q0 4.5-4.5 4.5h-12q-4.5 0-4.5-4.5z"/>';
    var ACTS_CD = ['macromolecule', 'simple chemical', 'nucleic acid feature', 'complex', 'unspecified entity'].map(function (c) {
      var k = ACT_NAME[c]; return [c === 'macromolecule' ? 'activity' : k, ACTS.filter(function (q) { return q[0] === k; })[0][1], PD_SIGN[c]];
    });
    // a nucleic acid feature's activity as two presets, in both views (gene told apart
    // from mRNA; the AF specification's conceptual types, text in the unit as SBGN-ML keeps it): made with the unit's
    // text ct:gene or ct:mRNA (PRESET), retyped or removed from its right-click menu; the signs' words as the PD presets'
    var NAF_ACT = 'nucleic acid feature activity', NAF_CT = [['ct:gene', 'gene'], ['ct:mRNA', 'mRNA']];   // the conceptual types and their signs' words
    NAF_CT.forEach(function (q) { PRESET[NAF_ACT + ' ' + q[0]] = [NAF_ACT, [q[0]]]; });
    var nafSplit = function (set, sbgnLook) {
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
    var ACT_PROT = ACTS.filter(function (q) { return q[0] === 'protein activity'; })[0];
    var ACT_REST = ACTS.filter(function (q) { return q !== ACT && q !== ACT_PROT; }), ACT_REST_CD = ACTS_CD.filter(function (q) { return q[0] !== 'activity'; });
    var PERT = ['perturbing agent', 'Perturbation', PAL_PD[0][1].filter(function (q) { return q[0] === 'perturbing agent'; })[0][2]];
    var LOGIC = ['logic arc', 'Logic arc', '<path d="M3 12h18"/>'];
    function palAf(sbgnLook, prot) {
      var first = prot ? ACT_PROT : ACT;   // in the reduced notation view its sign the protein's, as drawn there (no box on entities), as the view's other signs
      return [
        ['Activity nodes', [sbgnLook ? first : [first[0], first[1], PD_SIGN.macromolecule]].concat(sbgnLook ? ACT_REST : ACT_REST_CD, [PHENO, PERT])],
        OTHER,
        ['Logical operators', GATES_PD.concat([DELAY])],
        ['Arcs', INFL.map(function (x) { var q = ARC_PD[x[0]]; return [q[0], sbgnLook || x[0] === 'necessary stimulation' ? x[1] : q[1] + ' (' + x[1].toLowerCase() + ')', q[2]]; }).concat([LOGIC])]
      ];
    }
    var PALS = { pd: PAL_PD, rn: palAf(false), sbgn: palAf(true), rnP: palAf(false, true), sbgnP: palAf(true, true) };
    var ARCS = {}, MODK = {};   // the signs that draw an arc, not a glyph (Connecting arcs, Modulating arcs), and among them the modulations
    PAL_PD[4][1].forEach(function (q) { ARCS[q[0]] = 1; if (!/^(consumption|production)$/.test(q[0])) MODK[q[0]] = 1; });   // sbgn_edit loads later
    ARCS['logic arc'] = 1;
    function arcTool() { return tool && ARCS[tool.kind] ? tool.kind : null; }
    var tool = null;   // { kind, sticky } in hand
    var pal = document.createElement('div');
    pal.className = 'm2-ed-palette'; pal.hidden = true; pal.setAttribute('role', 'toolbar'); pal.setAttribute('aria-label', 'Palette');
    // which set the palette shows: PD or AF, and AF's look, per map in this browser; a map not chosen yet
    // starts on what its file is (an Activity Flow file AF in the SBGN view, else PD)
    var PAL_KEY = 'atlas-edit-palette', palSet = { lang: 'pd', look: 'rn' };
    function palStore() { try { return JSON.parse(localStorage.getItem(PAL_KEY)) || {}; } catch (e) { return {}; } }
    function palId() { return site && (site.id || site.path) || name || null; }   // the map edited (V.current is the editor's own entry then)
    function palFor() {   // the map's choice, else from its file
      var all = palStore(), id = palId(), k = id && all[id];
      if (k && (k.lang === 'pd' || k.lang === 'af')) return { lang: k.lang, look: k.look === 'sbgn' ? 'sbgn' : 'rn', strict: k.strict === true };
      var af = sbJs.isAf(sb && sb.base);
      return { lang: af ? 'af' : 'pd', look: af ? 'sbgn' : 'rn', strict: false };
    }
    function palKeep() { var all = palStore(), id = palId(); if (!id) return; all[id] = palSet; try { localStorage.setItem(PAL_KEY, JSON.stringify(all)); } catch (e) {} }
    // one list by default, as yEd's palette, the groups' signs one after another (grouping is of little use to experienced
    // curators, and the Edit window scrolls less); Settings' Grouped palette tick box puts
    // the group names back (atlas-app.html)
    function palGrouped() { try { return localStorage.getItem('atlas-edit-palette-groups') === 'on'; } catch (e) { return false; } }
    function palSign(q) {
      return '<button type="button" data-make="' + q[0] + '" title="' + q[1] + (ARCS[q[0]] ? ': picked, a drag from one node to another draws it (click: once; double click: several)' : CD_GATE[q[0]] ? ': click its inputs, then the reaction\u2019s square or the target species (click: once; double click: several)' : ' (click: once; double click: several)') + '" aria-label="' + q[1] + '" aria-pressed="false">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' + q[2] + '</svg></button>';
    }
    // the one list in blocks: a group marked as starting a block (its third item, true) begins a new row, so the list reads
    // as a few small groups with no names; kept while the blocks cost no row more than the plain list would at the panel's
    // width and at every width up to its usual one (palBlocks), else the plain list, so a narrowed panel stays compact
    function palSigns(set) {
      if (!palGrouped()) {
        var blocks = [];
        set.forEach(function (s, i) { if (!i || s[2]) blocks.push(0); blocks[blocks.length - 1] += s[1].length; });
        return '<div class="m2-ed-prow" data-blocks="' + blocks.join(',') + '">' + set.map(function (s, i) { return (i && s[2] ? '<span class="m2-ed-pbr" aria-hidden="true"></span>' : '') + s[1].map(palSign).join(''); }).join('') + '</div>';
      }
      return set.map(function (s) {
      var info = s[0] === 'Connecting arcs' || s[0] === 'Arcs' ? ' <button type="button" class="m2-ed-pinfo" aria-label="How arcs are drawn" title="How arcs are drawn"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="8" cy="8" r="7.2" stroke-width="1.1"/><path d="M8 7.3v4.2" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="4.6" r="1.2" fill="currentColor" stroke="none"/></svg></button>' : '';
      return '<p>' + s[0] + info + '</p><div class="m2-ed-prow">' + s[1].map(palSign).join('') + '</div>';
      }).join('');
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
    function hybOn() { return palLangNow() === 'pd' && palSet.strict !== true; }
    function palLangNow() { return palSet.lang === 'af' ? 'af' : 'pd'; }
    // the views (SBGN or CellDesigner) only where the map is pure Activity Flow or still empty (the AF SBGN view has no
    // process); elsewhere the reduced notation view, no switch shown
    function palViews() { var k = palKind(); return palLangNow() === 'af' && (k === 'af' || k === 'empty'); }
    // Activity Flow has no state variables, and an activity one unit of information: its shape the entity's kind, its text
    // free, set from the activity's right-click menu, never by a click on the unit
    function afMap() { return !!sb && palOn() && palLangNow() === 'af'; }
    // the map itself Activity Flow (palKind), whichever palette is chosen: what a glyph's right-click menu offers and whether
    // its state variables are picked follow the map, never the tab (else the AF tab would take them from a PD map)
    function afKind() { return !!sb && palKind() === 'af'; }
    function palLookNow() { return palViews() && palSet.look === 'sbgn' ? 'sbgn' : 'rn'; }
    function palBtn(attr, title, sign) { return '<button type="button" ' + attr + ' title="' + title + '" aria-label="' + title + '" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' + sign + '</svg></button>'; }
    function palView(look, name, title) { return '<button type="button" role="radio" data-look="' + look + '" title="' + title + '" aria-label="' + title + '" aria-checked="false"><span class="m2-ed-radio" aria-hidden="true"></span>' + name + '</button>'; }
    // the circled i beside the views and the tick boxes: its text in the title, and shown under the line by a click, hidden by the next (phones have no hover)
    var INFO = {
      strict: 'Corresponds to CellDesigner\'s Reduced Notation: stimulation, inhibition, necessary stimulation and modulation may also end on entities, which makes a hybrid map. Such links are outside the SBGN Process Description specification, and some tools may not read or save the SBGN-ML file correctly.',
      rn: 'Corresponds to CellDesigner\'s Reduced Notation palette, which enables an Activity Flow type of representation.',
      sbgn: 'Follows the SBGN Activity Flow specification. The map is saved as an Activity Flow SBGN-ML file.',
      prot: 'When ticked, shows the auxiliary unit on protein activities. An activity with no auxiliary unit is by default a protein activity.'
    };
    function palTip(line, name, t) {
      return '<div class="m2-ed-pline">' + line + '<button type="button" class="m2-ed-pinfo m2-ed-ptip" aria-label="About ' + name + '" title="' + t + '" aria-expanded="false"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="8" cy="8" r="7.2" stroke-width="1.1"/><path d="M8 7.3v4.2" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="4.6" r="1.2" fill="currentColor" stroke="none"/></svg></button></div>' +
        '<div class="m2-ed-ptext" hidden>' + t + '</div>';
    }
    pal.innerHTML = '<div class="m2-ed-prow m2-ed-pnot" role="group" aria-label="Notation">' +
      palBtn('data-lang="pd"', 'Process Description', '<text x="12" y="17.3" text-anchor="middle" font-size="15">PD</text>') +
      palBtn('data-lang="af"', 'Activity Flow', '<text x="12" y="17.3" text-anchor="middle" font-size="15">AF</text>') + '</div>' +
      // AF's two views as named round choices under the tabs (icons there would read as
      // glyphs to drag onto the map), shown only where the views apply (palViews)
      '<div class="m2-ed-plook" role="radiogroup" aria-label="Activity Flow view">' +
      palTip(palView('rn', 'Reduced notation view', 'Reduced notation view: each activity drawn as its entity'), 'Reduced notation view', INFO.rn) +
      palTip(palView('sbgn', 'SBGN AF view', 'SBGN Activity Flow view: each entity drawn as its SBGN activity'), 'SBGN Activity Flow view', INFO.sbgn) + '</div>' +
      '<div class="m2-ed-pblk m2-ed-pprot">' + palTip('<label class="m2-ed-phyb" title="Ticked: every protein activity carries the auxiliary unit of a macromolecule, drawn and saved in the file; unticked: none has it"><input type="checkbox"><span>Protein auxiliary unit</span></label>', 'Protein auxiliary unit', INFO.prot) + '</div>' +
      '<div class="m2-ed-pblk m2-ed-pstrict">' + palTip('<label class="m2-ed-phyb" title="Ticked (the default): under PD a modulation may also end on an entity, and a logic gate\u2019s output go to one (CellDesigner\u2019s reduced notation); with a process on the map the file stays Process Description, without one such a link makes it Activity Flow. Unticked: Process Description only"><input type="checkbox"><span>Reduced notation</span></label>', 'Reduced notation', INFO.strict) + '</div>' +
      '<div class="m2-ed-psigns"></div>';
    var palSignsEl = pal.querySelector('.m2-ed-psigns'), palShown = null;
    function palBlocks() {   // the blocks of the one list shown, or the plain list (palSigns)
      var row = palSignsEl.querySelector('.m2-ed-prow[data-blocks]'), b = row && row.querySelector('button');
      if (!row || !b) return;
      var n = row.dataset.blocks.split(',').map(Number), all = n.reduce(function (a, x) { return a + x; }, 0);
      var gap = parseFloat(getComputedStyle(row).columnGap) || 0, step = b.offsetWidth + gap, most = parseFloat(getComputedStyle(pal).maxWidth) || row.clientWidth;
      var cols = Math.max(1, Math.floor((row.clientWidth + gap) / step)), top = Math.max(cols, Math.floor((most + gap) / step)), flat = false;
      for (var c = cols; c <= top && !flat; c++) flat = n.reduce(function (a, x) { return a + Math.ceil(x / c); }, 0) > Math.ceil(all / c);
      row.classList.toggle('m2-ed-pflat', flat);
    }
    if (window.ResizeObserver) new ResizeObserver(palBlocks).observe(palSignsEl);
    function palKey() { return palLangNow() === 'pd' ? 'pd' : palLookNow() + (protOn ? 'P' : ''); }
    // the tick box's state lives in the file: on opening, ticked when the map's protein activities all
    // carry the protein's unit, unticked when none or some do; read again after every change where they all agree (an
    // undo of the tick included), kept where they are mixed or there are none, so new protein activities follow it
    var protOn = false, protMemo = [null, null];
    function protFile() {   // true: every protein activity has the box; false: none; null: mixed, or no protein activity (one whose unit has text not counted: it keeps its unit either way)
      if (protMemo[0] === text) return protMemo[1];
      var A = sbJs.activities(text, null, true), u = Object.keys(A).map(function (k) { return A[k]; }).filter(function (x) { return x === '' || x === 'macromolecule'; });
      var r = !u.length ? null : u.every(function (x) { return x === 'macromolecule'; }) ? true : u.every(function (x) { return x === ''; }) ? false : null;
      protMemo = [text, r];
      return r;
    }
    // the map's own choices for new nodes (Style, Colours) in a block of their own under the palette (pmap), shown where
    // Properties is while nothing is selected: rows as Properties' (the name, then a field with its arrow), the field's
    // list a small window of its own over the page, as a graph editor's drop-down: the field's width at least, under the
    // field, above it where the window has no room below; closed by a choice, Escape, a press elsewhere, a scroll or a
    // resize. Rows in the order made.
    // o: { key, label, title, list: [[id, name, title]], get(), set(id), sq(id): the choice's squares as HTML, or none }
    var pmap = document.createElement('div'); pmap.className = 'm2-ed-pmap'; pmap.hidden = true;
    pmap.innerHTML = '<table class="m2-ed-ptab"></table>';
    var ddOpen = null;   // the open list's window (_r: its row, _t and _list: the map and choices it was made from)
    function ddClose() {
      if (!ddOpen) return;
      var f = ddOpen._r.querySelector('.m2-ed-pdd'), back = ddOpen._keys && ddOpen.contains(document.activeElement);
      f.setAttribute('aria-expanded', 'false');
      ddOpen.remove(); ddOpen = null;
      if (back) f.focus();   // opened by the keys: the focus back on its field
    }
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
          var w = box.offsetWidth * k, h = box.offsetHeight * k, below = window.innerHeight - 4 - f.bottom, above = f.top - 4;
          var y = h + 2 * k <= below || below >= above ? f.bottom + 2 * k : f.top - 2 * k - h;
          box.style.left = Math.max(4, Math.min(f.left, window.innerWidth - 4 - w)) / k + 'px';
          box.style.top = Math.max(4, Math.min(y, window.innerHeight - 4 - h)) / k + 'px';
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
    var CHOICE_KEY = 'atlas-edit-map-choices', choiceMemo = {};
    try { ['atlas-edit-style', 'atlas-edit-sb-colours', 'atlas-edit-cd-colours'].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}   // the earlier choices for every map at once
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
    var ORIG_KEY = 'atlas-edit-originals';
    function origAll() { try { return JSON.parse(localStorage.getItem(ORIG_KEY)) || {}; } catch (e) { return {}; } }
    function origKeep(id, r) { var all = origAll(); all[id] = r; try { localStorage.setItem(ORIG_KEY, JSON.stringify(all)); return true; } catch (e) { return false; } }
    var pickSeq = 0;
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
          if (!r) { if (cur !== 'file') note('Original: no colours of this map kept; the map stays as it is.'); paint(); return; }
          var added = back(r);
          if (added) note('Original: ' + added + ' element' + (added > 1 ? 's' : '') + ' added since ' + (added > 1 ? 'keep their' : 'keeps its') + ' colour.');
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
      var id = palId(), b = cd ? cd.now : null, M = choiceMemo;
      if (M.id === id && M.t === text && M.b === b) return M.v;
      var key = cd ? null : text.replace(GEO, '');
      if (M.id === id && !cd && M.key === key) { M.t = text; return M.v; }
      var k = mapChoice('cols', ids), v = k === 'custom' || (k && is(k) !== false) ? k : null;   // Original while the map has its kept colours (or none were kept)
      if (!v) ids.some(function (m) { return m !== 'file' && m !== 'custom' && is(m) === true && (v = m); });
      choiceMemo = { id: id, t: text, b: b, key: key, v: v || 'file' };
      return choiceMemo.v;
    }
    // Style, the sizes of new nodes, kept per map (mapChoice): the size most nodes of that kind
    // have on the map (sbgn_edit.defaults, cd_make.classSize; the built-in size where it has none), or the built-in sizes
    // Custom: the size kept by Set as default for that kind (each format keeps its own: atlas-edit-defaults,
    // atlas-edit-cd-defaults), From map for a kind with none
    var STYLES = [['file', 'From map', 'New nodes the size most nodes of their kind have on this map'], ['default', 'Default', 'New nodes at the editor\u2019s own sizes'], ['custom', 'Custom', 'New nodes the size kept by Set as default; From map for a kind with none']];
    function palStyle() { return mapChoice('style', ['file', 'default', 'custom']) || 'file'; }
    function styleRow() { return palDrop({ key: 'style', label: 'Style', title: 'Sizes of new nodes', list: STYLES, get: palStyle, set: function (v) { keepMapChoice('style', v); } }); }
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
    var CONF = null;
    function confettiOne(hex) {   // a colour (#rrggbb) one of Confetti's pastels
      if (!CONF) { CONF = {}; for (var k = 0; k < 64; k++) CONF[confettiHex(k * 137.508 % 360).toUpperCase()] = 1; }
      return !!hex && CONF[String(hex).slice(0, 7).toUpperCase()] === 1;
    }
    function confettiSquares() { return '<span class="m2-cs-sw">' + [0, 1, 2, 3, 4].map(function (k) { var x = confettiHex(k * 137.508 % 360); return '<i style="background:' + x + '" title="' + x.toUpperCase() + '"></i>'; }).join('') + '</span>'; }
    // Colours on SBGN-ML maps, kept per map or read from it (mapCols): the map's own (sbgn_edit.defaults: the fill most glyphs of the
    // kind have; the Default colours for a kind the map lacks), the viewer's Default colours, none, or Confetti
    var SB_COLS = [['file', 'Original', 'The map\u2019s own colours, as they were before another choice; new glyphs in the colour most glyphs of their kind have on it'], ['default', 'Default', 'The whole map and new glyphs in the viewer\u2019s Default colours'], ['none', 'No colours', 'The whole map and new glyphs unfilled'], ['custom', 'Custom', 'The whole map and new glyphs in the colours kept by Set as default; a kind with none as it is'], ['confetti', 'Confetti', 'Every glyph of the map, and every new one, a pastel of its own']];
    function sbCols() { return mapCols(['file', 'none', 'default', 'confetti', 'custom'], sbIs); }
    var SB_SQ = ['macromolecule', 'simple chemical', 'nucleic acid feature', 'phenotype', 'compartment'];
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
    function sbColsRow() { return palDrop({ key: 'cols', label: 'Colours', title: 'Colours of the map and of new glyphs', list: SB_COLS, get: sbCols, set: function (v) { colsPick(v, sbCols(), function () { return sbJs.colours(text); }, sbOriginal, sbRecolour); }, sq: sbSquares }); }
    function sbOriginal(r) {   // the colours kept put back: each node's fill and border, each line's, those the record knows
      var now = sbJs.colours(text), M = {}, added = 0;
      Object.keys(now.node).forEach(function (id) { var o = r.node && r.node[id], a = now.node[id]; if (!o) added++; else if (o.fill !== a.fill || o.line !== a.line) M[id] = { fill: o.fill, line: o.line }; });
      Object.keys(now.edge).forEach(function (id) { if (!r.edge || !(id in r.edge)) added++; });
      var t2 = sbJs.restyleAll(text, M, null, function (id) { return r.edge && id in r.edge && r.edge[id] !== now.edge[id] ? r.edge[id] : undefined; });
      if (t2 !== text) { remember(false); text = t2; made([]); }
      return added;
    }
    // a choice of Colours recolours the whole map, one undo step: every entity, complex and compartment its fill by the
    // choice (its border black), as a new one of its kind would get it (defOf); Original puts back the map's own (colsPick); Custom a
    // kind with a kept look its fill, border and width, the rest as they are; Confetti every entity, complexes too, a pastel
    // of its own, one after another (compartments as they are). Every line black, under Confetti a colour of its own
    // (confettiLine); processes, gates and the other glyphs their border black. One parse (sbgn_edit.restyleAll)
    var SB_FILLED = /^(macromolecule|simple chemical|nucleic acid feature|unspecified entity|perturbing agent|phenotype|complex|compartment|submap|biological activity|perturbation)( multimer)?$/;
    var sbActMemo = [null, {}];
    function sbPlan(mode, pick) {   // [[node index, its look], ...] under a choice of Colours, as sbRecolour sets them (pick: Confetti's colours picked)
      if (sbActMemo[0] !== text) sbActMemo = [text, sbJs.activities(text)];   // one parse per change of the map (sbIs asks for each choice)
      var cls = sbClasses(), acts = sbActMemo[1], kept = mode === 'custom' ? defsKept() : {}, hues = [], P = [];
      nodes2.forEach(function (n, i) {
        var c = cls[n.id] || '';
        if (!SB_FILLED.test(c)) { if (sbJs.LOOKS.test(c) && mode !== 'custom') P.push([i, { line: null }]); return; }
        var base = c.replace(/ multimer$/, ''), u = acts[n.id], o;
        var ff = sbJs.fillFor(u != null ? 'biological activity' : base, u);
        if (mode === 'default') o = { fill: ff, line: null };
        else if (mode === 'none') o = { fill: null, line: null };
        else if (mode === 'custom') { var k = kept[lookKey(base, u)]; if (!k) return; o = {}; ['fill', 'line', 'width'].forEach(function (q) { if (q in k) o[q] = k[q]; }); }
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
        var now = sbJs.colours(text);
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
      var lh = [], t2 = sbJs.restyleAll(text, M, null, mode === 'custom' ? null : function () { return mode === 'confetti' ? confettiLine(lh).toUpperCase() : null; });
      if (t2 === text) return;
      remember(false); text = t2; made([]);
    }
    function palFill() {   // the signs of the set chosen; the tabs and the look marked
      var k = palKey();
      var lang = palLangNow(), look = palLookNow();
      var pn = pal.querySelector('.m2-ed-pnot'); pn.hidden = false; pn.style.display = '';   // hidden on a CellDesigner map (cdFill)
      styleRow(); sbColsRow();   // the map's choices for new glyphs (pmap); a CellDesigner map shows the same rows with its own (cdFill)
      Array.prototype.forEach.call(pal.querySelectorAll('[data-lang]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
      Array.prototype.forEach.call(pal.querySelectorAll('[data-look]'), function (b) { b.setAttribute('aria-checked', String(b.dataset.look === look)); });
      pal.querySelector('.m2-ed-plook').hidden = !palViews();
      var hy = pal.querySelector('.m2-ed-pstrict'), hyc = hy.querySelector('input');
      hy.hidden = lang !== 'pd';
      cdInfo(hy, false);   // its SBGN texts back after a CellDesigner map
      if (hyc.checked !== hybOn()) hyc.checked = hybOn();   // ticked: reduced notation allowed (strict off)
      var pb = pal.querySelector('.m2-ed-pprot'), pbc = pb.querySelector('input');
      pb.hidden = !palViews();   // only on an Activity Flow map or an empty one (proteinBoxes leaves a map turned PD as it is)
      if (!pb.hidden) { var pf = protFile(); if (pf != null) protOn = pf; k = palKey(); }
      if (pbc.checked !== protOn) pbc.checked = protOn;
      if (palShown === k) return;
      palShown = k;
      if (tool && !palOk(tool.kind)) tool = null;   // a sign in hand that this set lacks (e.g. a delay kept after the map turned PD)
      palSignsEl.innerHTML = palSigns(PALS[k]); palBlocks();
      var pi = palSignsEl.querySelector('.m2-ed-pinfo');
      if (pi) pi.addEventListener('click', function (e) { e.stopPropagation(); help(true, 'Connecting arcs'); });
    }
    function palLook() {   // the map drawn in the SBGN view while AF's SBGN view is chosen and the map has no process (graphml.js afSbgn)
      var want = palOn() && palLookNow() === 'sbgn';
      if (want === afSbgn) return;
      afSbgn = want;
      if (on && V.current === map && !cd) render();
    }
    function palPick(lang, look) {
      palSet = { lang: lang || palSet.lang, look: look || palSet.look, strict: palSet.strict };
      if (tool && !palOk(tool.kind)) tool = null;
      palKeep(); palFill(); palShow();   // palShow sets the look
    }
    function palOk(kind) { return PALS[palKey()].some(function (s) { return s[1].some(function (q) { return q[0] === kind; }); }); }
    pal.addEventListener('click', function (e) {
      var ti = e.target.closest('.m2-ed-ptip');
      if (ti) { var tx = ti.parentNode.nextElementSibling, open = tx.hidden; tx.hidden = !open; ti.setAttribute('aria-expanded', String(open)); ti.blur(); return; }
      var b = e.target.closest('button[data-lang], button[data-look]');
      if (b && !b.disabled) palPick(b.dataset.lang, b.dataset.look);
    });
    pal.querySelector('.m2-ed-pstrict input').addEventListener('change', function (e) { e.target.blur(); if (cdPal()) return; palSet.strict = !e.target.checked; palKeep(); });   // a CellDesigner map's own: cdcreate.js   // blurred: the editor's keys (undo) work at once
    pal.querySelector('.m2-ed-pprot input').addEventListener('change', function (e) {   // every protein activity given the box or not, one undo step
      protOn = e.target.checked; e.target.blur();   // the editor's keys (undo) work at once, not the tick box's
      var t2 = palOn() ? sbJs.proteinBoxes(text, protOn) : text;
      if (t2 !== text) { remember(false); text = t2; parse(); dirty = true; render(); changed(); }
      palShow(); paint();
    });
    var palMap = null;
    function palSync() { var id = palId(); if (id !== palMap) { palMap = id; palSet = palFor(); protOn = protFile() === true; palShown = null; palFill(); } }   // only when the map changes (palShow runs on every paint)
    box.querySelector('.m2-ed-tools').insertAdjacentElement('afterend', pal);
    function palOn() { return on && V.current === map && !!sb && !!sbJs && V.level === 'full'; }
    function palShow() {
      var cdp_ = cdPal(), show = palOn() || cdp_;   // a CellDesigner map: its own set (cdcreate.js)
      if (cdp_) cdFill();
      else if (show) { palSync(); palFill(); }   // palFill: a process added or removed turns the SBGN view off or on
      pal.hidden = !show;
      pmap.hidden = !show || !!(selN.length || selE.length || selP.length || svSel);   // only while nothing is selected
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
    function palTake(kind, sticky) { tool = kind ? { kind: kind, sticky: !!sticky } : null; cdGate = null; palShow(); }   // a CellDesigner gate's clicks begun start again
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
    document.getElementById('m2-set-palette').addEventListener('change', function () { setTimeout(function () { palShown = null; palShow(); }, 0); });   // Settings, Grouped palette: the signs made again
    document.addEventListener('keydown', function (e) { if (tool && e.key === 'Escape') palTake(null); }, true);

    // the map clicked with something in hand: a press only noted, so a drag still moves the map; the click is taken on release
    var placeAt = null, placedAt = 0;   // placedAt: when something was last put on the map (a double click there is not a second request)
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
      var del = sbJs.gone(text), used = function (q) { return text.indexOf('"' + q + '"') >= 0 || s.indexOf('"' + q + '"') >= 0 || s.indexOf("'" + q + "'") >= 0 || del.indexOf(q) >= 0 || (taken || []).indexOf(q) >= 0; };   // an id deleted earlier is not used again (a draft reopened on an older build would join them)
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
      if (!on || V.current !== map || V.level !== 'full' || !moved.length || (cd ? !cdMk || !cdMk.join : !palOn() || !sbJs.join || palKind() === 'af' || afSbgn)) return out;
      var at = {}, cx = [], mv0 = {};
      nodes2.forEach(function (n, i) { at[n.id] = i; if (n.shape.kind === 'Complex') cx.push(i); });
      moved.forEach(function (id) { mv0[id] = 1; });
      var out0 = {}; (leaving || []).forEach(function (id) { out0[id] = 1; });
      var inCx = function (i) { for (var u = nodes2[i].up; u != null; u = nodes2[u].up) if (nodes2[u].shape.kind === 'Complex') return true; return false; };
      moved.forEach(function (id) {
        var i = at[id];
        if (i == null || out.why || (cd && cdOwn(i)) || (nodes2[i].up != null && mv0[nodes2[nodes2[i].up].id]) || (!out0[id] && inCx(i))) return;
        var b = boxOf(i), P = [b[0] + b[2] / 2, b[1] + b[3] / 2], best = -1, area = Infinity;
        cx.forEach(function (j) {   // the innermost complex round its centre that does not move with it
          var q = boxOf(j);
          if (mv0[nodes2[j].id] || P[0] < q[0] || P[1] < q[1] || P[0] > q[0] + q[2] || P[1] > q[1] + q[3] || q[2] * q[3] >= area) return;
          for (var u = nodes2[j].up; u != null; u = nodes2[u].up) if (mv0[nodes2[u].id]) return;
          best = j; area = q[2] * q[3];
        });
        if (best < 0) return;
        var why;
        try { why = cd ? cdMk.joinable(cd.now, id, nodes2[best].id) : sbJs.joinable(text, id, nodes2[best].id); } catch (err) { return; }
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
      var sel = selN.map(function (i) { return nodes2[i].id; }), done = [];
      if (cd) {
        var N = cdNow(), t = N.t;
        joins.forEach(function (q) { try { t = cdMk.join(t, q[0], q[1]); done.push(q[1]); } catch (err) { warn(String(err && err.message || err)); } });
        if (done.length) cdRebuild(t, N.sh);
      } else joins.forEach(function (q) { try { text = sbJs.join(text, q[0], q[1], { checked: true }); done.push(q[1]); } catch (err) { warn('A glyph could not be put into the complex.'); } });
      if (!done.length) return done;
      parse(); dirty = true;
      var at = {}; nodes2.forEach(function (n, i) { at[n.id] = i; });
      selN = sel.filter(function (id) { return at[id] != null; }).map(function (id) { return at[id]; });
      return done;
    }
    // the complexes that took a member packed, in the same undo step (Pack's own code, layTool)
    function joinPack(cids) { if (cids.length) layTool('pack', cids, true); }
    function makeEntity(P, cls) {
      var units = PRESET[cls] ? PRESET[cls][1] : null; cls = baseKind(cls);
      var act = ACT_UNIT[cls], D = defOf(cls), w = D.w, h = D.h, X = P[0] - w / 2, Y2 = P[1] - h / 2;   // act: an activity's unit
      if (gridSet.snap) { X += toGrid(X + w / 2, gridSet.step); Y2 += toGrid(Y2 + h / 2, gridSet.step); }   // its centre on the grid, as a drag puts it
      var bx0 = [+fmt(X), +fmt(Y2), w, h], c = holder(bx0, function () { return false; }, boxOf), id = freeId('glyph_'), onCx = innermost(P, function (n) { return n.shape.kind === 'Complex'; }) >= 0;   // c: the innermost compartment holding its box
      var t2;
      try { t2 = sbJs.add(text, { id: id, cls: act != null ? sbJs.unitClass(act) : cls, activity: act, label: '', box: bx0, parent: c != null ? nodes2[c].id : null, fill: D.fill, line: D.line, width: D.width, multimer: D.multimer, font: D.font, units: units || undefined }); }
      catch (err) { warn('The ' + (act != null ? 'activity' : cls) + ' could not be added: ' + (err && err.message || err) + '.'); return; }
      remember(false); text = t2;
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
    // ORDER is how new ones fill them, the most used first, from the bottom (the top is for the
    // unit of information): the bottom's middle, right and left of it, the sides' middles, the bottom corners, the top
    // corners, then the top and the sides' other places
    var ORDER = [[0, 0.5], [0.25, 0.5], [-0.25, 0.5], [0.5, 0], [-0.5, 0], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5],
      [0, -0.5], [0.25, -0.5], [-0.25, -0.5], [0.5, 0.25], [-0.5, 0.25], [0.5, -0.25], [-0.5, -0.25]];
    // a drag lands on the nearest of more places: each side cut in eighths,
    // so the corners, the middles, the quarters and the points between; the arrow keys move it by single units (below)
    var PLACES = (function () { var out = [], k; for (k = -4; k <= 4; k++) { out.push([k / 8, -0.5], [k / 8, 0.5]); if (Math.abs(k) < 4) out.push([-0.5, k / 8], [0.5, k / 8]); } return out; })();
    function border(i, P) {   // the place nearest P
      var b = boxOf(i), best = null, d0 = Infinity;
      PLACES.forEach(function (q) { var d = Math.hypot(b[0] + (0.5 + q[0]) * b[2] - P[0], b[1] + (0.5 + q[1]) * b[3] - P[1]); if (d < d0) { d0 = d; best = q; } });
      return best.slice();
    }
    // the right-click menu over a macromolecule (not over its state variables or units): Add state variable, Add unit of
    // information, Make multimer or Make macromolecule (SBGN's names, macromolecule and macromolecule
    // multimer); [label, action] pairs
    var NAME_WORDS = { tl: 'Name at top left', t: 'Name at top middle', tr: 'Name at top right', bl: 'Name at bottom left', b: 'Name at bottom middle', br: 'Name at bottom right' };
    // Select all of this kind, at the end of the right-click menu over a node: every node of the map of its kind selected
    // (SBGN-ML: its class, a multimer with its plain kind; CellDesigner: its species class, or compartment; GraphML: its
    // shape), so Properties sets them together
    ownMenus.push(function (P) { return sb && svAt(P); });   // a state variable or unit of information: its own menu only
    window.m2EditNodeItems = function () {
      var it = nodeItems(), h = rclick && on && V.current === map ? hit(rclick) : null, i = h && h.n != null && h.p == null ? h.n : -1;
      if (i < 0 || (sb && svAt(rclick)) || kindKey(i) == null) return it;   // not over a state variable or unit (its own menu)
      it = it || [];
      it.tail = [['Select all of this kind', function () { selectKind(i); }]];   // the object's last item before Delete
      return it;
    };
    function kindKey(i) {
      var n = nodes2[i];
      if (!n) return null;
      if (cd) { var c1 = cdClsOf(n.id); return c1 ? c1[0] : n.comp ? 'compartment' : null; }
      if (sb) { var c = sbClasses()[n.id]; return c ? c.replace(/ multimer$/, '') : null; }
      return n.shape && n.shape.kind || null;
    }
    function selectKind(i) {
      var key = kindKey(i);
      if (key == null) return;
      selN = nodes2.map(function (n, k) { return kindKey(k) === key && !(afSbgn && inComplex(k)) ? k : -1; }).filter(function (k) { return k >= 0; });   // not the members the SBGN AF view does not draw
      selP = []; selE = []; part = null; svSel = null;
      paint();
    }
    function nodeItems() {
      if (cdPal()) return cdItems();   // a CellDesigner map's (cdcreate.js)
      var P = rclick, k = P && palOn() && !svAt(P) ? madeAt(P) : -1;
      if (k < 0 && P && palOn()) {   // a modulation under the pointer: Change identity, its kinds
        var h = hit(P), ed = h && h.e != null && h.p == null ? edges2[h.e] : null, now = ed && Object.keys(MODK).filter(function (c) { return sbJs.ARROW[c] === ed.arr[1]; })[0];
        var afN = afKind();   // an AF map (the map, not the tab): its influences by AF's names, no catalysis there
        if (now) return lateItem(['Change identity', subItem(function (r, done) {   // its kinds by Change identity (core.js kindWindow), the palette's names
          return kindWindow(r, PAL_PD[4][1].filter(function (q) { return MODK[q[0]] && !(q[0] === 'catalysis' && (afN || roleOf(ed.t) === 'pheno')); }).map(function (q) {
            var c = q[0], af = afN && sbJs.AF_ARC[c];
            return { name: af ? af[0].toUpperCase() + af.slice(1) : q[1], own: c === now, go: function () {
              var t2 = sbJs.arcKind(text, ed.id, c);
              if (t2 === text) return;
              remember(false); text = t2; parse(); selN = []; selP = []; part = null;
              selE = edges2.map(function (e2, j) { return e2.id === ed.id ? j : -1; }).filter(function (j) { return j >= 0; });
              dirty = true; render(); paint(); changed();
            } };
          }), done);
        })]);
      }
      // an activity under AF: made another kind, its unit
      // given, or its unit taken off (a protein's activity again: with no auxiliary unit an activity is a protein's)
      var au = k >= 0 && afMap() ? sbJs.activities(text)[nodes2[k].id] : null;
      if (au == null && k >= 0 && afMap() && palKind() === 'af' && !nodes2[k].kids.length) au = sbJs.unitFor(nodes2[k].shape.kind);   // a plain entity of an AF map: written as its activity (a file's turned so, toAf)
      if (au === undefined) au = null;
      if (au != null) {
        var aid = nodes2[k].id, setU = function (u) { return function () { var t2 = sbJs.activity(text, aid, u); if (t2 === text) return; remember(false); text = t2; made(aid); }; };
        // its unit's text (free text, not restricted to a vocabulary): typed, or
        // ct:gene and ct:mRNA on a nucleic acid feature's; one unit per activity (AF), so one text
        var ui = svList(k).filter(function (q) { return q[3] === UI; })[0], ut = ui ? ui[0] : '';
        var setT = function (v) { return function () {
          var t2 = ui ? (v === null ? sbJs.unitDelete(text, aid, 0) : sbJs.unitValue(text, aid, 0, v)) : sbJs.unit(text, aid, v);
          if (t2 === text) return; remember(false); text = t2; made(aid);
        }; };
        var typeT = function () {
          if (!ui) { var t2 = sbJs.unit(text, aid, ''); if (t2 === text) return; remember(false); text = t2; made(aid); }
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
          return ['Make ' + c.toUpperCase(), function () { var t2 = sbJs.kind(text, gid, c); if (t2 === text) return; remember(false); text = t2; made(gid); }];
        });
      }
      if (k >= 0 && !afKind() && nodes2[k].shape.kind === 'NucleicAcidFeature' && /^nucleic acid feature( multimer)?$/.test(sbJs.classOf(src(), nodes2[k].id))) {   // its units of information, the conceptual types offered
        var nid = nodes2[k].id;
        return [['Add unit of information', function () { makeUnit(nid); }],
                ['Add unit of information ct:mRNA', function () { makeUnit(nid, 'ct:mRNA'); }],
                ['Add unit of information ct:gene', function () { makeUnit(nid, 'ct:gene'); }]];
      }
      var pc = k >= 0 && nodes2[k].shape.kind === 'Process' ? sbJs.classOf(src(), nodes2[k].id) : '';
      if (sbJs.PROCESSES.indexOf(pc) >= 0) {   // its kinds by Change identity, the palette's names (not an association or dissociation of a file)
        var pid = nodes2[k].id, psigns = PAL_PD.filter(function (g) { return g[0] === 'Process nodes'; })[0][1];
        return lateItem(['Change identity', subItem(function (r, done) {
          return kindWindow(r, sbJs.PROCESSES.map(function (c) {
            var q = psigns.filter(function (s) { return s[0] === c; })[0];
            return q && { name: q[1], own: c === pc, go: function () { var t2 = sbJs.kind(text, pid, c); if (t2 === text) return; remember(false); text = t2; made(pid); } };
          }).filter(Boolean), done);
        })]);
      }
      // a compartment's name in one of its six places (never in the middle):
      // over a named compartment and nothing else, the places it is not in (sbgn_edit.nameAt)
      var stackOn = on && V.current === map && !cd && full() && !!sbJs;   // stacking on GraphML maps too (Full editing), names on SBGN-ML maps
      var hc = k < 0 && P && (palOn() || stackOn) ? hit(P) : null;
      if (hc && hc.n != null && hc.p == null && nodes2[hc.n].comp) {
        var cid = nodes2[hc.n].id, np = palOn() ? sbJs.namePlaces(text, cid) : null, sm = sbJs.stackMoves(text, cid);   // the places its name can take (a name too wide for a side: the middles only); where it partly overlaps another, its order
        var go = function (t2) { if (t2 === text) return; remember(false); text = t2; made(cid); };
        var its = (np ? np[1] : []).map(function (q) { return [NAME_WORDS[q], function () { go(sbJs.nameAt(text, cid, q)); }]; });
        if (sm[1]) its.push(['Bring forward', function () { go(sbJs.restack(text, cid, 1)); }]);
        if (sm[0]) its.push(['Send backward', function () { go(sbJs.restack(text, cid, -1)); }]);
        if (its.length) return its;
      }
      var i = P && palOn() && !afKind() && !svAt(P) ? macroAt(P) : -1;   // none added on an AF map (afKind)
      if (i < 0 || !/^macromolecule( multimer)?$/.test(sbJs.classOf(src(), nodes2[i].id))) return null;   // not an Activity Flow activity drawn as one (write() carries none of its changes)
      var id = nodes2[i].id, multi = isMulti(i);
      return [['Add state variable', function () { makeState(P); }],
              ['Add unit of information', function () { makeUnit(id); }],
              [multi ? 'Make macromolecule' : 'Make multimer', function () {
                var t2 = sbJs.multimer(text, id, !multi);
                if (t2 === text) return;
                remember(false); text = t2; made(id);
              }]];
    }
    function isMulti(i) {   // drawn as a multimer: yEd's mcount (sbgn_edit.multimer)
      var r = realizerOf(nodes2[i].el), sp = r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'StyleProperties'; })[0];
      return !!sp && Array.prototype.some.call(sp.children, function (c) { return c.getAttribute('name') === 'com.yworks.sbgn.style.mcount' && c.getAttribute('value') !== '1'; });
    }
    function makeState(P) {   // an empty state variable on the first free place in ORDER (anywhere on the shape, from the bottom), selected to be dragged
      var i = macroAt(P);
      if (i < 0) return;
      var b = boxOf(i), have = svList(i), r = ORDER.filter(function (q) {
        return !have.some(function (h) { return Math.hypot(b[0] + (0.5 + q[0]) * b[2] - h[1][0], b[1] + (0.5 + q[1]) * b[3] - h[1][1]) < Math.max(18, h[2][0]); });
      })[0] || ORDER[0];
      var id = nodes2[i].id, j = have.filter(function (h) { return h[3] === SV; }).length;   // after the state variables, before the units
      remember(false); text = sbJs.state(text, id, '', r[0], r[1]); made(id);
      selN = []; svSel = { id: id, j: j }; paint();
    }
    // an empty unit of information, as with state variables (made at once, its text added by a double
    // click): N:2's box (the converter's smallest), the last on the top, selected
    function makeUnit(id, value) {   // value: a unit with its text (ct:mRNA), else an empty one
      var i = nodes2.findIndex(function (n) { return n.id === id; });
      if (i < 0) return;
      var j = svList(i).length;   // the units come last in the node's list
      var t2 = sbJs.unit(text, id, value || '');
      if (t2 === text) return;
      remember(false); text = t2; made(id);
      selN = []; svSel = { id: id, j: j }; paint();
    }
    function made(id) {   // the text changed by a palette action: read again, the node (or nodes: an array) selected, drawn, saved
      var ids = [].concat(id);
      parse(); selN = []; selP = []; selE = []; part = null;
      nodes2.forEach(function (n, i) { if (ids.indexOf(n.id) >= 0) selN.push(i); });
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
    // map; Enter or leaving it keeps it, Esc not (a unit's text free: N:3, mt:prot, ct:mRNA)
    var typing = null;
    function typeIn(id, j, fresh) {   // fresh: the unit was made for this typing, deleted again when nothing is kept
      if (typing) typing.done(true);
      var i = nodes2.findIndex(function (n) { return n.id === id; });
      if (i < 0) return;
      var b = boxOf(i), sv = j == null ? null : svList(i)[j];
      if (j != null && !sv) return;
      var unit = !!sv && sv[3] === UI;
      selN = []; selP = []; selE = []; part = null; svSel = null; paint();   // only the cursor while typing, nothing shown selected
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
      var au0 = unit && afSbgn ? sbJs.activities(text)[id] : null;   // an activity's unit in the SBGN AF view: typed where it is drawn (afUnitBox)
      if (au0 != null) { var B0 = sbJs.afUnitBox(b, au0, sv[0] || 'x'); at0 = [B0[0] + 1, B0[1] + 1, B0[2] - 2, B0[3] - 2]; }
      var inp = document.createElement('input'), before = !sv ? (cd ? cdNameOf(id) : nameOf(i)) : sv[0], m0 = map;   // a CellDesigner name from its file (cdcreate.js)
      inp.type = 'text'; inp.className = 'm2-ed-type'; inp.value = before; inp.spellcheck = false;
      inp.setAttribute('aria-label', !sv ? 'Name' : unit ? 'Unit of information' : 'State variable (value, or value@site)');
      // the drawn text hidden while typing, the field itself transparent (a filled field cut the shape's
      // rounded corners); before the editor's own drawing is in the page, the field in the glyph's fill. Whether the
      // drawing is there, not whether it has text: an empty glyph has no text to hide and would still get the filled box
      var hid = au0 != null ? Array.prototype.slice.call(gN && gN[id] ? gN[id].querySelectorAll('text.m2-af-ut') : []) : textsOf(i, j);
      hid.forEach(function (el) { el.style.visibility = 'hidden'; });
      inp.style.background = gN && gN[nodes2[i].id] ? 'transparent' : !sv && fl && fl.getAttribute('hasColor') !== 'false' && fl.getAttribute('color') ? fl.getAttribute('color').slice(0, 7) : '#fff';
      inp.style.color = lab && lab.getAttribute('textColor') || '#000';
      var place = function () {   // at the glyph in the map's units: again after every zoom or pan (paint), so a pinch keeps it on its glyph
        var st = inp.style;
        if (unit) {   // a unit of information grows with its text round its centre, as the converter sizes it (5.4 a character, 8 more)
          var cx = at0[0] + at0[2] / 2, uw = Math.max(at0[2], Math.ceil(inp.value.length * 5.4 + 8) + 4);
          at0[0] = cx - uw / 2; at0[2] = uw;
        }
        st.left = sx(at0[0]) + 'px'; st.top = sy(at0[1]) + 'px'; st.width = at0[2] * V.z + 'px'; st.height = at0[3] * V.z + 'px'; st.fontSize = fs * V.z + 'px';
        if (sv && !unit) st.borderRadius = at0[3] * V.z / 2 + 'px';
        if (padL != null) { st.textAlign = 'left'; st.paddingLeft = padL * V.z + 'px'; }
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
          if (fresh && (!keep || !v) && on && map === m0) { var t0 = undo.length ? unpush() : text; if (t0 !== text) { text = t0; parse(); dirty = true; quiet(); render(); paint(); changed(); } return; }
          if (!keep || v === before.replace(/[\r\n]+/g, ' ') || !on || map !== m0 ) return;   // a name on several lines, untouched, kept as it was (the box shows it on one)
          if (!sv) { setName(id, v); return; }
          if (cd) return;
          var t2 = unit ? sbJs.unitValue(text, id, sv[4], v) : sbJs.stateValue(text, id, sv[4], v);
          if (t2 === text) return;
          if (!fresh) remember(false);   // a unit made for this typing: one step with its making (its step is taken back when nothing is kept, above)
          text = t2; parse(); dirty = true; quiet(); render(); paint(); changed();
        }, inp: inp, place: place
      };
      inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); typing && typing.done(true); V.view.focus({ preventScroll: true }); }
        else if (e.key === 'Escape') { e.preventDefault(); typing && typing.done(false); V.view.focus({ preventScroll: true }); }
      });
      inp.addEventListener('blur', function () { if (typing && typing.inp === inp) typing.done(true); });
      inp.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      setTimeout(function () { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 0);   // only the cursor, at the end, nothing selected in blue
    }
    // a name written as typing writes it (typeIn): a CellDesigner map's into its file (cdcreate.js), an SBGN-ML map's label
    function nameNow(i) { return (cd ? cdNameOf(nodes2[i].id) : nameOf(i)).replace(/[\r\n]+/g, ' ').trim(); }   // a name as one line (a CellDesigner one from its file, cdcreate.js)
    function shownName(i) { return (cd ? cdNameOf(nodes2[i].id, true) : nameOf(i)).replace(/[\r\n]+/g, ' ').trim(); }   // the name as drawn: a CellDesigner member still named after its id gives that id
    function setName(id, v) {
      if (cd) { cdRename(id, v); return; }
      if (!sbJs || sb && !sbJs.nameable(src(), id)) return;   // a GraphML map's label written as it stands (no SBGN-ML class to ask)
      var t2 = sbJs.label(text, id, v);
      if (t2 === text) return;
      remember(false); text = t2; parse(); dirty = true; quiet(); render(); paint(); changed();
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
    window.m2EditNameHere = function (member) {
      var c = complexHere(member);
      if (c == null || afSbgn || afKind()) return null;   // not in an Activity Flow view, where members are not drawn
      var v = membersName(c), id = nodes2[c].id, go = function () { setName(id, v); };
      go.same = v === nameNow(c) || !cd && (!sbJs || sb && !sbJs.nameable(src(), id));   // greyed only when already so named (or the file cannot take a name), so the item stays where it is found
      return go;
    };
    // a double click on a named entity, or on one of its state variables or units of information, opens its text
    V.view.addEventListener('dblclick', function (e) {
      if (!palOn() || !editing(e)) return;
      if (tool || Date.now() - placedAt < 600) { e.stopImmediatePropagation(); return; }   // the clicks of a placing: no box
      var base = src(), P = at(e), q = svAt(P), i = innermost(P, function (n, k) {   // a compartment by its top band, where its name is (inside it the double click stays the map's)
        return (n.el.getAttribute('yfiles.foldertype') !== 'group' || (n.comp && P[1] - boxOf(k)[1] <= 24 && !nameBox(k))) && sbJs.nameable(base, n.id);
      });
      if (q) { e.stopImmediatePropagation(); typeIn(nodes2[q[0]].id, q[1]); return; }
      var g = nameHit(P, function (n) { return sbJs.nameable(base, n.id); });   // a group's name where it is drawn (a complex's too)
      if (g >= 0 && (i < 0 || nodes2[i].el.getAttribute('yfiles.foldertype') === 'group')) i = g;
      if (i >= 0) { e.stopImmediatePropagation(); typeIn(nodes2[i].id, null); }
    }, true);
    function svAt(P) {   // the state variable or unit of information under P: [node, j] (it may stand out of its node)
      if (afSbgn || afKind()) return null;   // not drawn in the SBGN AF view; an activity's unit text is set from its right-click menu, never clicked, moved or typed
      var res = svIcons(), found = null, pad = 3 / V.z, acts = sb && palKind() === 'hybrid' ? sbJs.activities(text) : null;   // a hybrid map's activities keep their units as on an AF map
      nodes2.forEach(function (n, k) {
        if (n.shape.kind !== 'Macromolecule' && n.shape.kind !== 'NucleicAcidFeature' || (acts && acts[n.id] != null)) return;
        svList(k, res).forEach(function (q, j) { if (Math.abs(P[0] - q[1][0]) <= q[2][0] / 2 + pad && Math.abs(P[1] - q[1][1]) <= q[2][1] / 2 + pad) found = [k, j]; });
      });
      return found;
    }

    // a state variable selected: a click selects it, a drag moves it along its node's border, snapping
    // to the nearest of its places (PLACES) only, its own drawing following; the arrow keys move it by single units; a click on it selected opens its text; Delete or the right-click menu
    // deletes it
    var svSel = null, svDrag = null, svKey = null;   // svSel: { id, j }; svKey: a move by the arrow keys under way
    function svNode() { if (!svSel) return -1; var i = nodes2.findIndex(function (n) { return n.id === svSel.id; }); return i >= 0 && svList(i)[svSel.j] ? i : -1; }
    function svMarks(over) {   // four black squares at the corners of the state variable selected (paint, core.js)
      if (typing) typing.place();   // the text field follows a zoom or a pan
      var i = svNode();
      if (i < 0 || !palOn()) { svSel = null; return; }
      var q = svList(i)[svSel.j], c = svDrag && svDrag.to ? svDrag.to : svKey ? svKey.to : q[1], hs = Math.max(2, HANDLE * V.z);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d) {
        over.push('<rect class="m2-ed-handle" x="' + f1(sx(c[0] + d[0] * q[2][0] / 2) - hs / 2) + '" y="' + f1(sy(c[1] + d[1] * q[2][1] / 2) - hs / 2) + '" width="' + f1(hs) + '" height="' + f1(hs) + '"/>');
      });
    }
    // a press on a state variable (called by the core's press before nodes, the state variable being on
    // top): a click on it selects it, also over its macromolecule, selected or not; true when it takes the press
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
    function textsOf(i, j, res) {   // the drawn text of node i's name (j null) or of its j-th icon; res: svIcons(), read once by a caller going through many nodes
      var g = gN && gN[nodes2[i].id];
      if (!g) return [];
      var svs = svList(i, res), r = V.view.getBoundingClientRect(), k = V.pz();
      var rect = function (q) { var L = r.left + sx(q[1][0] - q[2][0] / 2) * k, T = r.top + sy(q[1][1] - q[2][1] / 2) * k; return [L - 1.5, T - 1.5, L + q[2][0] * V.z * k + 1.5, T + q[2][1] * V.z * k + 1.5]; };
      var inside = function (b, R) { var cx = b.left + b.width / 2, cy = b.top + b.height / 2; return cx >= R[0] && cx <= R[2] && cy >= R[1] && cy <= R[3]; };
      return Array.prototype.filter.call(g.querySelectorAll('text:not(.m2-af-ut)'), function (t) {   // not an activity's unit text of the SBGN AF view
        if (t.closest('[data-n]') !== g) return false;   // a member's own drawing, if nested, is not this node's text
        var b = t.getBoundingClientRect();
        return j == null ? !svs.some(function (q) { return inside(b, rect(q)); }) : inside(b, rect(svs[j]));
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
    window.addEventListener('pointermove', function (e) {
      if (!svDrag || !svSel) return;
      if (!e.buttons) { svUp(); return; }   // released outside the window: no sticky hand
      if (!svDrag.to && Math.hypot(e.clientX - svDrag.x, e.clientY - svDrag.y) < 4) return;
      if (svDrag.fixed) { svDrag.moved = true; return; }   // a unit of information is not dragged; a drag on it is no click
      var i = svDrag.i, b = boxOf(i), r = border(i, at(e)), q = svList(i)[svSel.j];
      if (!svDrag.parts) svDrag.parts = svParts(i, q);   // the state variable itself moves, as other items on the map, no copy
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
    function nodesDelete(list, arcs) {   // the glyphs the palette makes, an empty compartment too, deleted with every line at them,
      // and the lines selected with them (one undo step, as cdDelete on a CellDesigner map)
      var ids = list.filter(function (i) { return isMade(nodes2[i]) || emptyComp(nodes2[i]); }).map(function (i) { return nodes2[i].id; });
      var eids = (arcs || []).map(function (k) { return edges2[k] && edges2[k].id; }).filter(Boolean);
      if (!ids.length && !eids.length) return false;
      var t2 = ids.length ? sbJs.remove(text, ids) : text;
      if (eids.length) t2 = sbJs.arcRemove(t2, eids);
      if (t2 === text) return false;
      remember(false); text = t2; selN = []; selP = []; selE = []; part = null;
      parse(); dirty = true; render(); paint(); changed();
      return true;
    }
    // the arrow keys move the state variable selected round its node's border by 1 unit, with Shift by 10, along
    // the border, free of the places. The key's direction along the
    // side: on the bottom Right and Down go right, Left and Up go left; a key across the side goes clockwise inward,
    // anticlockwise outward. A key held keeps its first direction round the corners.
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
    function keyDir(b, t, d) {   // +1 clockwise, -1 anticlockwise; as the arrow points wherever it can (on a side, Down is down)
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
      if (svDelete() || (!selP.length && (selN.length || selE.length) && nodesDelete(selN, selE))) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    window.m2EditDelete = function () {   // the right-click menu's Delete over a state variable, a unit of information, a macromolecule or a simple chemical
      if (cdPal()) return cdDeleteItem();   // a CellDesigner map's (cdcreate.js)
      if (!palOn() || !rclick) return null;
      var q = svAt(rclick);
      if (q) return function () { svSel = { id: nodes2[q[0]].id, j: q[1] }; svDelete(); };
      var i = madeAt(rclick);
      if (i < 0) i = innermost(rclick, emptyComp);
      if (i >= 0) return function () { if (selN.indexOf(i) >= 0) nodesDelete(selN, selP.length ? [] : selE); else nodesDelete([i]); };   // over the selection: all of it (as the key)
      var h = hit(rclick);   // a line: everything selected with it, or it alone
      if (!h || h.e == null || h.p != null) return null;
      return function () { if (selE.indexOf(h.e) >= 0 && !selP.length) nodesDelete(selN, selE); else arcsDelete([h.e]); };
    };
    function arcsDelete(list) {   // arcs deleted, the file's own and those made (Settings, Editing on Full, SBGN-ML maps)
      var ids = list.map(function (k) { return edges2[k] && edges2[k].id; }).filter(Boolean);
      if (!ids.length) return false;
      var t2 = sbJs.arcRemove(text, ids);
      if (t2 === text) return false;
      remember(false); text = t2; selN = []; selP = []; selE = []; part = null;
      parse(); dirty = true; render(); paint(); changed();
      return true;
    }

    // a sign dragged from the palette onto the map: the future node at its own size and the map's zoom
    // follows the pointer inside the map window only, so over the panel it is hidden behind it and slides in as it nears
    // the map, as if already on the map behind the panel; it is put where it is dropped
    var palDrag = null;
    var GHOST = { submap: 'rectangle', compartment: 'roundrectangle', process: 'rectangle', 'omitted process': 'rectangle', 'uncertain process': 'rectangle' };   // the outline a dragged sign is drawn with where yEd's kind (sbgn_edit's MAKE) is not outlineD's
    pal.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('button[data-make]');
      if (b && e.button === 0 && !ARCS[b.dataset.make] && !CD_GATE[b.dataset.make]) palDrag = { kind: b.dataset.make, x: e.clientX, y: e.clientY, img: null };   // a gate is clicked, never dropped
    });
    function palOver(e) { var r = V.view.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
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
        var w = D.w, h = D.h, cmp = palDrag.kind === 'compartment', au = ACT_UNIT[baseKind(palDrag.kind)], act = afSbgn && au != null, sh = act ? { kind: 'Macromolecule', props: { radius: '0' } } : { kind: GHOST[palDrag.kind] || sbJs.MAKE[au != null ? sbJs.unitClass(au) : baseKind(palDrag.kind)], props: { radius: '10', radiusX: '12', radiusY: '12' } };   // in the SBGN AF view an activity's rectangle, else its entity
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
    var link = null;   // { from, x, y, moved, to, P, how }
    function linkEnd(P, not) {   // the innermost entity, process, gate or phenotype under P (a complex, not its member: roleOf), not node `not`
      var R = 4 / V.z, best = -1, ba = Infinity;
      nodes2.forEach(function (n, i) {
        var b = boxOf(i), r = cd ? cdRole(i) : roleOf(i);
        if (i === not || !r || P[0] < b[0] - R || P[0] > b[0] + b[2] + R || P[1] < b[1] - R || P[1] > b[1] + b[3] + R) return;
        if (b[2] * b[3] < ba) { ba = b[2] * b[3]; best = i; }
      });
      return best < 0 && cd ? cdLineAt(P, not) : best;   // a CellDesigner reaction taken by its main line (cdcreate.js)
    }
    var downs = new Set();   // the pointers down on the map: a second finger (a pinch) never begins a line
    window.addEventListener('pointerdown', function (e) { downs.add(e.pointerId); }, true);   // before the map's own (core.js stops the press it takes)
    ['pointerup', 'pointercancel'].forEach(function (k) { window.addEventListener(k, function (e) { downs.delete(e.pointerId); }, true); });
    // A line starts only from a node with an arc's sign picked in the palette. With no sign picked, a drag on a node not
    // selected moves the map, as in the viewer, so a missed aim never starts a line.
    function linkDown(e, P, h) {   // a press on a node with an arc's sign picked: a line begun there
      if (!(palOn() || cdPal()) || e.shiftKey || downs.size > 1 || link) return false;
      if (!arcTool()) return false;   // no sign picked: a drag on a node moves the map (or what is selected)
      if (h.n == null && !h.glyph && !(cd && cdAdd())) return false;   // a press on a line or a bend point selects it, but for CellDesigner's Add reactant and Add product
      var i = linkEnd(P, -1);
      if (i < 0) return false;
      if (cd && !cdStartOk(i)) return false;   // a CellDesigner gate's one line out is made with it: a drag moves the gate; Add reactant and Add product from their own ends only
      e.stopImmediatePropagation(); e.preventDefault();
      V.view.setPointerCapture(e.pointerId); V.view.focus({ preventScroll: true });
      link = { from: i, pid: e.pointerId, x: e.clientX, y: e.clientY, moved: false, to: -1, P: P, how: null, at: text };
      tap = { h: h, shift: false, x: e.clientX, y: e.clientY };   // no drag: a click, which selects (release, core.js)
      return true;
    }
    // what a line from node a to node b makes: { cls }, { pair }, { no: the reason }, or null over nothing. P: where it is
    // let go. With no sign picked (not reached since lines need a sign: kept for a start without one): an entity
    // into a process a consumption, or a modulation when it lands on a side off the antennas of a process that has them;
    // a process to an entity a production; two entities a process between them; into a gate a logic arc (from an entity,
    // or a gate into a gate), out of a gate a stimulation (to a process or a phenotype), out of an equivalence a logic
    // arc to its entity; an entity to a phenotype a stimulation. The modulation guessed is a stimulation, or a catalysis
    // from a macromolecule or complex onto a process that consumes a simple chemical (a metabolic step)
    function linkHow(a, b, P) {
      if (cd) return cdHow(a, b, P);   // a CellDesigner map's (cdcreate.js), with where its end lands
      if (b < 0) return null;
      var ra = roleOf(a), rb = roleOf(b), want = arcTool(), eqA = !!nodes2[a].eq, eqB = !!nodes2[b].eq;
      var has = function (s, t, head) { return edges2.some(function (q) { return q.s === s && q.t === t && q.arr[1] === head; }); };
      var ok = function (cls) { return has(a, b, sbJs.ARROW[cls]) ? { no: 'This ' + cls + ' is there already.' } : { cls: cls }; };
      var outs = function (g) { return edges2.filter(function (q) { return q.s === g; }).length; }, ins = function (g) { return edges2.filter(function (q) { return q.t === g; }).length; };
      if (ra === 'pheno') return { no: 'Nothing leaves a phenotype: it is modulated by an entity or a logic gate.' };
      if (ra === 'gate' && outs(a)) return { no: 'A logic gate has one line out, and this one has it.' };   // SBGN PD; the converter's rules for the equivalence
      var word = function (i) { var l = nodes2[i].el.getElementsByTagNameNS(Y, 'NodeLabel')[0]; return l ? l.textContent.trim() : ''; };   // a gate's word as drawn (a made one is not in the file yet)
      if (rb === 'gate' && (word(b) === '\u03c4' || word(b).toUpperCase() === 'NOT') && ins(b)) return { no: 'A ' + (word(b) === '\u03c4' ? 'delay' : 'NOT gate') + ' has one input, and this one has it.' };
      var af = palLangNow() === 'af';   // Activity Flow: influences join two activities, and leave a gate for one
      if (af) {
        if (ra === 'epn' && rb === 'epn') return want && !MODK[want] ? { no: 'Activity Flow joins activities by an influence.' } : ok(want || 'stimulation');
        if (ra === 'gate' && !eqA && rb === 'epn') return want && !MODK[want] ? { no: 'A logic gate\u2019s output is an influence.' } : ok(want || 'stimulation');
      } else if (hybOn()) {   // Hybrid: a modulation picked may end on an entity (two entities with no sign still get a process between them)
        if (ra === 'epn' && rb === 'epn' && want && MODK[want]) return want === 'catalysis' ? { no: 'A catalysis ends on a process.' } : ok(want);
        if (ra === 'gate' && !eqA && rb === 'epn' && (!want || MODK[want])) return want === 'catalysis' ? { no: 'A catalysis ends on a process.' } : ok(want || 'stimulation');
      }
      if (want === 'logic arc' && rb !== 'gate' && !(eqA && rb === 'epn')) return { no: 'A logic arc goes into a logic gate.' };
      if (want === 'catalysis' && rb === 'pheno') return { no: 'A catalysis ends on a process; a phenotype takes a stimulation, inhibition or modulation.' };   // as the converter's rules
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
        return rb === 'epn' ? { no: 'A logic gate’s output goes to a process, a phenotype or another gate (Reduced notation is unticked in the palette).' } : ok('stimulation');
      }
      if (rb === 'pheno') {
        if (ra !== 'epn' || want) return { no: 'A phenotype is modulated by an entity or a logic gate (a stimulation, unless another modulation is picked).' };
        return ok('stimulation');
      }
      if (ra === 'proc' && rb === 'proc') return { no: 'An arc goes from an entity into a process (a consumption) or from a process to an entity (a production), not between two processes.' };
      // two entities (a shortcut): a process made between them, with Consumption or Production picked
      if (ra === 'epn' && rb === 'epn') return !want || want === 'consumption' || want === 'production' ? { pair: true } : { no: 'A ' + want + ' does not join two entities. A process is made between them with Consumption or Production picked.' };
      var cls = ra === 'epn' ? 'consumption' : 'production';
      if (want && want !== cls) return { no: want === 'consumption' ? 'A consumption goes from an entity into a process.' : 'A production goes from a process to an entity.' };
      if (!want && cls === 'consumption' && P && offAxis(b, P)) {   // landed on a side off the antennas: a modulation
        var n = nodes2[a], sub = edges2.some(function (q) { return q.t === b && q.arr[1] === 'none' && nodes2[q.s].shape.kind === 'SimpleChemical'; });
        return ok(sub && (/^(Macromolecule|Complex)$/.test(n.shape.kind) || n.kids.length > 0) ? 'catalysis' : 'stimulation');
      }
      if (has(a, b, cls === 'production' ? 'delta' : 'none')) return { no: 'This ' + cls + ' is there already.' };
      return { cls: cls };
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
      if ((e.pointerType === 'mouse' && !e.buttons) || link.at !== text) { link = null; tap = null; paint(); return true; }   // its release never came; the map changed under it (undo)
      if (!link.moved && Math.hypot(e.clientX - link.x, e.clientY - link.y) < 5) return true;
      link.moved = true; tap = null;
      link.P = at(e); link.to = linkEnd(link.P, link.from); link.how = linkHow(link.from, link.to, link.P);
      paint();
      return true;
    }
    function linkUp(e) {   // the release (core.js): a line drawn is made; no drag, the click selects as before
      if (!link || e.pointerId !== link.pid) return false;
      var l = link; link = null;
      if (!l.moved) return false;
      e.stopImmediatePropagation(); paint();
      if (e.type !== 'pointerup' || !l.how || l.at !== text) return true;
      if (l.how.no) return true;   // refused (drawn dashed, its target not lit while dragged): nothing made, nothing said
      linkMake(l.from, l.to, l.how);
      if (tool && !tool.sticky) palTake(null);
      return true;
    }
    function linkMake(a, b, how) {
      if (cd) { cdLink(a, b, how); return; }
      var ia = nodes2[a].id, ib = nodes2[b].id, t2 = text, ids = [], o = { sbgn: src() };
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
      if (t2 === text) return;
      remember(false); text = t2;
      parse(); selN = []; selP = []; part = null;
      selE = edges2.map(function (q, k) { return ids.indexOf(q.id) >= 0 ? k : -1; }).filter(function (k) { return k >= 0; });   // the new arcs selected: Delete takes them back at once
      dirty = true; quiet(); render(); paint(); changed();
    }
    function linkPaint(out) {   // the line being drawn (paint, core.js): from its node's centre to the pointer, the node that would take it lit
      cdGateMarks(out); cdOverMarks(out);   // a CellDesigner gate's inputs clicked so far, Add product's join under the pointer (cdcreate.js)
      if (!link || !link.moved || link.at !== text) return;
      var A = bx(link.from), C = [A[0] + A[2] / 2, A[1] + A[3] / 2], no = !!(link.how && link.how.no);
      // drawn behind its nodes, as the line after the drop: from where it leaves its node's shape outline, none while the
      // pointer is still inside it, and over a node that would take it up to where it meets that node's outline
      var P = link.P, inFrom = inRim(rimOf(link.from, A), [P[0] - C[0], P[1] - C[1]]), S = inFrom ? null : cutShape(link.from, C, P, A);
      if (S && link.to >= 0 && link.to !== link.from) P = cutShape(link.to, P, S, bx(link.to));
      var E = cd && S ? cdLiveEnds(S, P, C) : null;   // an added reactant's or product's join (cdcreate.js)
      if (E) { S = E[0]; P = E[1]; }
      if (cd) cdLinkMarks(out, E);   // CellDesigner's marks (cdcreate.js)
      else if (link.how && !no) out.push('<g transform="translate(' + f1(V.tx - x0 * V.z) + ',' + f1(V.ty - y0 * V.z) + ') scale(' + V.z + ')"><path class="m2-ed-dark" d="' + shapeD(link.to) + '"/></g>');
      if (S) out.push('<path class="m2-ed-live" stroke-width="' + f1(Math.max(1, V.z)) + '"' + (no ? ' stroke-dasharray="4 3"' : '') + ' d="M' + f1(sx(S[0])) + ' ' + f1(sy(S[1])) + 'L' + f1(sx(P[0])) + ' ' + f1(sy(P[1])) + '"/>');
    }
    document.addEventListener('keydown', function (e) { if (link && e.key === 'Escape') { link = null; tap = null; paint(); } }, true);

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
      return n.shape.kind === 'Complex' && n.kids.length ? !afSbgn : f.sizable(i);
    }
    function setSize(i, nb) { setSizes([[i, nb]]); }
    function setSizes(pairs) {   // [[node, box], ...]: one undo step for them all (Properties with several nodes selected)
      var f = propFmt(); if (f) f.size(pairs.map(function (q) { return [q[0], q[1].map(function (v) { return +fmt(v); })]; }));
    }
    function sbSizable(i) {   // a glyph made from the palette, a complex's member too (the complex grows round it), a compartment
      var n = nodes2[i];
      return !!n.comp || (isMade(n) && n.shape.kind !== 'Process' && n.shape.kind !== 'Operator');   // a compartment too (holderSize); a process or gate keeps its size (its antennas)
    }
    function sbSetSize(pairs) {   // each node given its box, one undo step with the compartments round them grown to hold them
      var ids = [], was = {}, t2 = text;
      try { pairs.forEach(function (q) { var id = nodes2[q[0]].id; ids.push(id); was[id] = boxOf(q[0]); t2 = sbJs.resize(t2, id, q[1]); }); }
      catch (err) { warn('Not resized: ' + (err && err.message || err) + '.'); liveOff(); sizeOff(); paint(); return; }
      if (t2 === text) { liveOff(); sizeOff(); paint(); return; }
      remember(false); text = t2; parse(); dirty = true;
      selN = []; nodes2.forEach(function (n, k) { if (ids.indexOf(n.id) >= 0) selN.push(k); });
      var ks = selN.slice();   // their holders grown round them as round a drag (grown)
      if (ks.length) setBoxes(grown(ks, boxOf, function (k) { return was[nodes2[k].id] || boxOf(k); }, function () { return false; }));
      refit(ids);
      sizeRec = null; render(); paint(); changed();
    }
    // Properties as yEd's Properties View (familiar from the graph editor, compact): two columns, the name on the left;
    // with Newt's fields the atlas maps keep (label, width, height, border and
    // fill colour, border width, so a map may be as colourful as its curator wants, multimer, Set as
    // default; state variables and units of information have their own ways on the map, Cloned skipped). A field is
    // applied on Enter or when it is left (Esc puts it back), a colour also when the picker closes; one undo step each.
    // Shown for any glyph selected that sbgn_edit restyles (LOOKS), its rows by its class (sbOff); Width and Height for a
    // member of a complex too (Pack keeps member sizes), not for a process or gate (their antennas), a holder's typed as
    // its handles resize it (holderSize). Grid size is beside the Grid and Snap switches (core.js)
    var ROWS = [['label', 'Label', 'text'], ['w', 'Width', 'num'], ['h', 'Height', 'num'], ['fill', 'Fill colour', 'colour'],
      ['line', 'Border colour', 'colour'], ['width', 'Border width', 'num'], ['multimer', 'Multimer', 'check']];
    // a row: [key, name, kind (text, num, colour, check, sel), its input's limits (sel: its options), its title]; a format's part may add its own rows (propRows)
    var props = document.createElement('div');
    props.className = 'm2-ed-props'; props.hidden = true;
    // a line's rows (yEd's Properties View for an edge): its colour, its two ports as offsets from its glyph's centre
    var EROWS = [['ecol', 'Line colour', 'colour'], ['sx', 'Source port X', 'num'], ['sy', 'Source port Y', 'num'],
      ['tx', 'Target port X', 'num'], ['ty', 'Target port Y', 'num']];
    // a reaction's rows, one reaction selected on a map whose format's part has a reaction's answers (PF_CD.rx)
    var RROWS = [['rev', 'Reversible', 'check']];
    function table(rows, cls) { return '<table class="m2-ed-ptab' + cls + '">' + rows.map(function (r) {
      var id = 'm2-ed-' + r[0], f = r[2] === 'check' ? '<input type="checkbox" id="' + id + '">'
        : r[2] === 'colour' ? '<span class="m2-ed-pc"><input type="color" tabindex="-1" aria-label="' + r[1] + ', picker"><input type="text" id="' + id + '" spellcheck="false" autocomplete="off"' + (r[0] === 'fill' ? ' placeholder="none"' : '') + '></span>'
        : r[2] === 'sel' ? '<select id="' + id + '"><option value="~" disabled hidden></option>' + r[3].map(function (o) { return '<option value="' + o[0] + '"' + (o[2] ? ' disabled hidden' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'   // r[3]: [value, name, shown only when it is the value]
        : r[2] === 'num' ? '<input type="number" id="' + id + '" step="any"' + (r[3] || (r[0] === 'width' ? ' min="0.25" max="20"' : /^[st][xy]$/.test(r[0]) ? '' : ' min="1" max="5000"')) + '>'
        : '<input type="text" id="' + id + '" spellcheck="false" autocomplete="off">';
      return '<tr data-k="' + r[0] + '"' + (r[4] ? ' title="' + r[4] + '"' : '') + '><th><label for="' + id + '">' + r[1] + '</label></th><td>' + f + '</td></tr>';
    }).join('') + '</table>'; }
    props.innerHTML = '<p>Properties</p>' + table(ROWS, ' m2-ed-pnode') + table(EROWS, ' m2-ed-pedge') + table(RROWS, ' m2-ed-prx') +
      '<button type="button" class="m2-ed-pdef" title="The next ones of this kind made from the palette take these">Set as default</button>';
    pal.insertAdjacentElement('afterend', props);
    props.insertAdjacentElement('afterend', pmap);
    var inW = props.querySelector('#m2-ed-w'), inH = props.querySelector('#m2-ed-h');
    var field = function (k) { return props.querySelector('#m2-ed-' + k); }, pNow = {};
    function propNode() {   // the one node selected that Properties is for (propFmt's node), else -1
      var f = propFmt();
      return !f || selN.length !== 1 || selP.length || selE.length || svSel ? -1 : f.node(selN[0]);
    }
    // the nodes selected that Properties is for (no line or other item selected with them): one alone, or of several
    // those it covers (a CellDesigner complex's member, which it does not, left out); [] else
    function propNodes() {
      var f = propFmt();
      if (!f || !selN.length || selP.length || selE.length || svSel) return [];
      var a = selN.map(function (i) { return f.node(i); });
      return selN.length === 1 ? (a[0] >= 0 ? a : []) : a.filter(function (i) { return i >= 0; });
    }
    function sbNode(i) {   // a glyph Properties restyles (sbgn_edit LOOKS: entities, complexes, compartments, processes, gates; its class read from the file once per selection and change)
      return sbJs.LOOKS.test(sbClasses()[nodes2[i].id] || '') ? i : -1;
    }
    // the rows a glyph has by its class: Label where sbgn_edit keeps a name (NAMED), Multimer where it writes one (MULTI); Set as default for the kinds the palette makes in a kept look
    function sbOff(k, i) {
      var c = sbClasses()[nodes2[i].id] || '';
      if (k === 'label') return !sbJs.NAMED.test(c);
      if (k === 'multimer') return !sbJs.MULTI.test(c.replace(/ multimer$/, ''));
      if (EXTRA.indexOf(k) >= 0) return true;   // another format's own rows (propRows)
      if (k === 'def') return !/^(macromolecule|simple chemical)( multimer)?$|^biological activity$/.test(c);
      return false;
    }
    // every glyph's class in the SBGN-ML file as written now, read once per change of the editor's text (src() writes the file)
    var sbClsMemo = [null, {}];
    function sbClasses() {
      if (sbClsMemo[0] !== text) {
        var m = {}, d = new DOMParser().parseFromString(src(), 'application/xml');
        Array.prototype.forEach.call(d.getElementsByTagNameNS('*', 'glyph'), function (g) { if (g.getAttribute('id')) m[g.getAttribute('id')] = g.getAttribute('class') || ''; });
        sbClsMemo = [text, m];
      }
      return sbClsMemo[1];
    }
    function lookKey(cls, unit) { return cls === 'biological activity' ? cls + ':' + (unit || '') : cls; }   // Set as default's kind: the glyph's class, an activity's by its unit
    function kindOf(i) {
      var c = (sbClasses()[nodes2[i].id] || '').replace(/ multimer$/, '');
      if (c === 'biological activity') return lookKey(c, sbJs.activities(text)[nodes2[i].id]);
      return c || (nodes2[i].shape.kind === 'SimpleChemical' ? 'simple chemical' : 'macromolecule');
    }
    function propsShow(all) {   // all: every field shown again, the one focused too (Esc)
      var i = propNode(), k = propEdge(), r2 = function (v) { return String(Math.round(v * 100) / 100); }, ns = propNodes();
      props.querySelector('.m2-ed-prx').hidden = true;
      if (ns.length > 1 || (ns.length && selN.length > 1)) return propsMany(ns, all, r2);
      var rx = propRx();
      if (rx) {   // one reaction: its Reversible tick box alone
        props.hidden = false;
        ['.m2-ed-pnode', '.m2-ed-pedge', '.m2-ed-pdef'].forEach(function (c) { props.querySelector(c).hidden = true; });
        props.querySelector('.m2-ed-prx').hidden = false;
        var fr = field('rev');
        if (all || document.activeElement !== fr) fr.checked = rx.on;
        var rk = lineOfRx();   // and its Line colour, the whole reaction's
        if (rk >= 0) { props.querySelector('.m2-ed-pedge').hidden = false; edgeShow(rk, all, r2); }
        return;
      }
      Array.prototype.forEach.call(props.querySelectorAll('.m2-mixed'), function (tr) { tr.classList.remove('m2-mixed'); });
      props.querySelector('#m2-ed-multimer').indeterminate = false;
      ROWS.forEach(function (r) { if (r[2] !== 'check' && r[2] !== 'sel') field(r[0]).placeholder = r[0] === 'fill' ? 'none' : ''; });
      props.hidden = i < 0 && k < 0;   // only with its node or line: nothing selected, no Properties
      if (props.hidden) return;
      props.querySelector('.m2-ed-pnode').hidden = i < 0; props.querySelector('.m2-ed-pedge').hidden = i >= 0;
      if (i < 0) { edgeShow(k, all, r2); return; }
      var pf = propFmt(), b = bx(i);
      pNow = pf.look(i);
      if (!pNow) { props.hidden = true; return; }
      Array.prototype.forEach.call(props.querySelectorAll('.m2-ed-pnode tr[data-k]'), function (tr) { tr.hidden = (/^[wh]$/.test(tr.dataset.k) && !sizable(i)) || pf.off(tr.dataset.k, i); });
      props.querySelector('.m2-ed-pdef').hidden = !pf.def || pf.off('def', i);   // the part may keep it from a kind (CellDesigner: species only)
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
    var mLook = [null, null, null];   // [nodes, their looks, the file read]
    function propsMany(ns, all, r2) {
      var pf = propFmt(), key = ns.join(','), now = cd ? cd.now : text;
      if (mLook[0] !== key || mLook[2] !== now) mLook = [key, ns.map(function (i) { var L = pf.look(i), b = bx(i); if (L) { L.w = r2(b[2]); L.h = r2(b[3]); ROWS.forEach(function (r) { if (r[2] === 'num' && L[r[0]] != null) L[r[0]] = r2(L[r[0]]); }); } return L; }), now];
      var Ls = mLook[1];
      if (Ls.some(function (L) { return !L; })) { props.hidden = true; return; }
      props.hidden = false;
      props.querySelector('.m2-ed-pnode').hidden = false; props.querySelector('.m2-ed-pedge').hidden = true;
      props.querySelector('.m2-ed-pdef').hidden = true;
      ROWS.forEach(function (r) {
        var tr = props.querySelector('.m2-ed-pnode tr[data-k="' + r[0] + '"]'), f = field(r[0]);
        tr.hidden = r[0] === 'label' || ns.some(function (i, j) { pNow = Ls[j]; return (/^[wh]$/.test(r[0]) && (!sizable(i) || holds(i))) || pf.off(r[0], i); });   // a holder's size alone (holderSize)
        if (tr.hidden || (!all && document.activeElement === f)) return;
        var vs = Ls.map(function (L) { return r[2] === 'check' ? !!L[r[0]] : String(L[r[0]] == null ? '' : L[r[0]]); }), one = vs.every(function (v) { return v === vs[0]; });
        tr.classList.toggle('m2-mixed', !one);
        if (r[2] === 'check') { f.indeterminate = !one; f.checked = one && vs[0]; return; }
        var v = one ? vs[0] : r[2] === 'sel' ? '~' : '';   // a choice that differs: its blank option
        if (f.value !== v) f.value = v;
        if (r[2] !== 'sel') f.placeholder = one && r[0] === 'fill' ? 'none' : '';
        var pk = f.previousElementSibling;
        if (r[2] === 'colour' && one && document.activeElement !== pk) pk.value = v || '#ffffff';
      });
    }
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
    function hex(v) {   // #rgb or #rrggbb, with or without #, as yEd writes it ('' for none, null not a colour)
      v = v.trim().replace(/^#/, '');
      if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/./g, '$&$&');
      return /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toUpperCase() : v ? null : '';
    }
    function propSet(k) {   // the label, a colour, the border width or multimer, from its field (the format's part writes it), to every node it is for
      var ns = propNodes();
      if (!ns.length) return;
      var f = field(k), v = k === 'multimer' ? f.checked : f.value;
      if (ns.length > 1 && k !== 'multimer' && v === '' && f.closest('tr').classList.contains('m2-mixed')) { propsShow(true); return; }   // left mixed: nothing set
      if (!keepSel(function () { return propFmt().set(k, v, ns); })) propsShow(true);
    }
    function keepSel(f) {   // a change made, the selection as it was (by id) selected again: a value set keeps every node chosen
      var ids = selN.map(function (i) { return nodes2[i].id; }), r = f();
      if (selN.length !== ids.length) { selN = []; nodes2.forEach(function (n, k) { if (ids.indexOf(n.id) >= 0) selN.push(k); }); paint(); }
      return r;
    }
    function sbSet(k, v, is) {   // every node of is given the value, one undo step; true when the text changed
      var ids = is.map(function (i) { return nodes2[i].id; }), t2 = text;
      ids.forEach(function (id) {
        if (k === 'label') t2 = sbJs.label(t2, id, v.replace(/[\r\n]+/g, ' '));
        else if (k === 'multimer') t2 = sbJs.multimer(t2, id, v);   // a count, if any, stays the unit of information typed (N:3)
        else if (k === 'width') { var x = parseFloat(v); if (isFinite(x)) t2 = sbJs.restyle(t2, id, { width: Math.min(Math.max(x, 0.25), 20) }); }   // outside 0.25 to 20: the nearest, silently
        else {
          var c = hex(v), o = {};
          if (c !== null && !(c === '' && k === 'line')) { o[k] = c === '#000000' && k === 'line' ? null : c || null; t2 = sbJs.restyle(t2, id, o); }
        }
      });
      if (t2 === text) return false;
      remember(false); text = t2; made(ids);
      return true;
    }
    function sbEnds(id, o, box) { var t2 = sbJs.scaleEnds(text, id, o, box); if (t2 !== text) { text = t2; parse(); } }   // a complex's line ends after its box was set (dragEnd, core.js)
    var PF_SB = { sizable: sbSizable, size: sbSetSize, node: sbNode, set: sbSet, def: sbDef, ends: sbEnds,
      line: { colour: sbLineColour, set: sbLineSet, ports: true },   // a line's colour and its ports' rows (edgeShow, edgeSet)
      off: sbOff,
      look: function (i) { var o = sbJs.lookOf(realizerOf(nodes2[i].el)); return { label: nameOf(i), fill: o.fill ? o.fill.slice(0, 7).toLowerCase() : '', line: (o.line || '#000000').slice(0, 7).toLowerCase(), width: o.width, multimer: o.multimer }; } };
    // a line's Properties, one line selected on a map whose format's part has a line's answers (PF_SB.line): Line colour
    // and its ports as yEd gives them, offsets from its glyph's centre (sx, sy at the source, tx, ty at the target), set
    // as a dragged end sets them (setPorts). An end at a process's or gate's port goes with it: shown, not typed.
    // A field applies to the line it was typed for (eFor), also when another line was clicked before it was left
    var eFor = null;
    function propRx() { var f = propFmt(); return f && f.rx ? f.rx.of() : null; }   // the reaction Properties is for ({ rid, on }), else null
    field('rev').addEventListener('change', function (e) {
      e.target.blur();   // the editor's keys (undo) work at once
      var r = propRx();
      if (!r || !propFmt().rx.set(r.rid, e.target.checked)) propsShow(true);   // not written: the box shows the file again
    });
    // a line selected alone that its format's part gives Properties (PF_SB.line, PF_CD.line: a colour it reads, null when
    // it has none of its own)
    function propEdge() {
      var f = propFmt(), k = selE[0];
      return f && f.line && selE.length === 1 && !selN.length && !selP.length && !svSel && edges2[k] && edges2[k].path && f.line.colour(k) != null ? k : -1;
    }
    function lineOfRx() {   // a line of the one reaction selected (Properties' reaction rows) whose colour is the reaction's, else -1
      var r = propRx(), f = propFmt();
      if (!r || !f.line) return -1;
      var k = edges2.findIndex(function (q) { return q.id.indexOf(r.rid + '|') === 0 && !/\|[mrp]\d+$/.test(q.id); });   // not a line with its own colour
      return k >= 0 && f.line.colour(k) != null ? k : -1;
    }
    function sbLineColour(k) { var el = edges2[k].path.parentNode; while (el && el.localName !== 'edge') el = el.parentNode; return sbJs.lineOf(el) || '#000000'; }
    function sbLineSet(k, c) {   // c '#rrggbb', null for black (yEd's default, no colour written); false when nothing changed
      var id = edges2[k].id, t2 = sbJs.recolour(text, id, c);
      if (t2 === text) return false;
      remember(false); text = t2; parse(); selE = []; edges2.forEach(function (q, j) { if (q.id === id) selE = [j]; });
      dirty = true; render(); paint(); changed();
      return true;
    }
    function atHub(k, end) { var e = edges2[k], n = end ? e.t : e.s; return n == null || !!nodes2[n].hub; }
    function edgeShow(k, all, r2) {
      props.querySelector('.m2-ed-pdef').hidden = true;
      var e = edges2[k], pl = propFmt().line;
      var now = { ecol: (pl.colour(k) || '#000000').slice(0, 7).toLowerCase() };
      ['sx', 'sy', 'tx', 'ty'].forEach(function (a) { now[a] = r2(num(e.path, a) || 0); });
      EROWS.forEach(function (r) {
        var f = field(r[0]);
        f.closest('tr').hidden = r[2] === 'num' && !pl.ports;   // the ports as offsets: yEd's, not every format's
        if (r[2] === 'num') f.disabled = atHub(k, r[0].charAt(0) === 't');
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
      var end = key.charAt(0) === 't', v = parseFloat(f.value), a = end ? ['tx', 'ty'] : ['sx', 'sy'];
      if (atHub(k, end) || !(Math.abs(v) <= 5000)) { propsShow(true); return; }
      var to = a.map(function (q) { return q === key ? v : num(e.path, q) || 0; });
      setPort({ k: k, end: end, n: end ? e.t : e.s, to: to });
    }
    EROWS.forEach(function (r) {
      var f = field(r[0]);
      [f, f.previousElementSibling].filter(Boolean).forEach(function (x) { x.addEventListener('focus', function () { var k = propEdge(); if (k < 0) k = lineOfRx(); eFor = k < 0 ? null : edges2[k].id; }); });
      f.addEventListener('change', function () { edgeSet(r[0]); });
      if (r[2] === 'colour') f.previousElementSibling.addEventListener('change', function (e) { f.value = e.target.value; edgeSet(r[0]); });
    });
    function propListen(r) {
      if (/^[wh]$/.test(r[0])) return;   // Width and Height: above
      var f = field(r[0]);
      f.addEventListener('change', function () { propSet(r[0]); if (r[2] === 'sel') f.blur(); });   // a choice made: the keys back to the map (undo)
      if (r[2] === 'colour') f.previousElementSibling.addEventListener('change', function (e) { f.value = e.target.value; propSet(r[0]); });
    }
    ROWS.forEach(propListen);
    // a format's part adds rows of its own after Border width, each call after the rows added before (its off() hides them where they do not apply; other parts' off() by EXTRA)
    var EXTRA = [];
    function propRows(rows) {
      var last = EXTRA.length ? EXTRA[EXTRA.length - 1] : 'width', at = props.querySelector('.m2-ed-pnode tr[data-k="' + last + '"]'), tmp = document.createElement('div');   // after the rows added before
      tmp.innerHTML = table(rows, '');
      Array.prototype.slice.call(tmp.querySelectorAll('tr')).reverse().forEach(function (tr) { at.insertAdjacentElement('afterend', tr); });
      var k = ROWS.findIndex(function (r) { return r[0] === last; });
      rows.forEach(function (r, j) { ROWS.splice(k + 1 + j, 0, r); EXTRA.push(r[0]); propListen(r); });
    }
    props.addEventListener('keydown', function (e) {   // Enter keeps the value, Esc takes it back; the map's keys stay out of the fields
      if (e.key === 'Enter') { e.target.blur(); e.preventDefault(); }
      else if (e.key === 'Escape') { propsShow(true); e.target.blur(); e.preventDefault(); }   // the value put back first, so leaving the field changes nothing
      e.stopPropagation();
    });
    // Set as default (Newt's): this node's size, colours, border and multimer kept as they are, by kind, in this browser
    // for every map (atlas-edit-defaults), and Style and Colours switched to Custom: Style Custom takes the size and
    // multimer, Colours Custom the fill, border colour and width; a kind with none kept takes From map
    var DEF_KEY = 'atlas-edit-defaults';
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
    props.querySelector('.m2-ed-pdef').addEventListener('click', function () {
      var i = propNode(), pf = propFmt();
      if (i >= 0 && pf.def) pf.def(i);
    });
    function keepLook(key, all) { try { localStorage.setItem(key, JSON.stringify(all)); return true; } catch (e) { warn('The default could not be kept in this browser.'); return false; } }
    function sbDef(i) {
      var o = sbJs.lookOf(realizerOf(nodes2[i].el)), b = boxOf(i), all = defsKept();
      all[kindOf(i)] = { w: b[2], h: b[3], fill: o.fill, line: o.line, width: o.width, multimer: o.multimer };   // as it is, no share of another size
      if (!keepLook(DEF_KEY, all)) return;
      keepMapChoice('style', 'custom'); keepMapChoice('cols', 'custom'); styleRow(); sbColsRow();
    }
