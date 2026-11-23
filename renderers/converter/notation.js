// notation: what a map's elements are in the notation's own terms, and what may be drawn between them, for every format
// the editor edits. A rule is written once, in the notation's terms (an entity, a process, an influence); each format
// gives only which of its classes is which kind. Under Node and in the page; it imports nothing.
//   nodeKind(format, cls, word) -> { kind, cls } or null: kind one of entity, process, gate, phenotype, submap, tag,
//     compartment; cls the entity's class (macromolecule, simple chemical, nucleic acid feature, unspecified entity,
//     complex, empty set, perturbing agent), the gate's (and, or, not, delay, equivalence) or the process's. format:
//     'graphml' (the yEd shapes the editor and the converter name: Macromolecule, Operator, ...; word: an Operator's
//     label), 'sbgnml' (glyph classes, Activity Flow's included), 'celldesigner' (species classes; a reaction's square
//     by its reaction type, a gate by BOOLEAN_LOGIC_GATE_*). null: a decoration, or a class this file does not know.
//   arcKind(format, cls, head) -> one of ARCS, or null. graphml: cls the arrowhead (none, delta, white_circle, ...), with
//     head the role of the target ('process', 'gate', 'entity', 'tag') to tell a plain line apart; sbgnml: the arc's
//     class (Activity Flow's influences as the modulation they stand for); celldesigner: a reaction's, a modification's
//     or a reduced notation reaction's type.
//   mapKind(format, text, engines) -> 'pd', 'af', 'hybrid' (PD with reduced notation), 'empty', or null when the text
//     does not tell. SBGN-ML: sbgn_edit.mapKind (engines.sbgn_edit), its one master; CellDesigner: hybrid when a reduced
//     notation reaction is in the file, else pd; GraphML: null (the editor's palette tab and tick box decide).
//   allowed(arc, from, to, ctx) -> null, or the reason the line is refused. from, to: nodeKind's answers. ctx: { sets:
//     the sets on (pd, reduced, af, strict, and the proposed fanout; house always), check(name): a reason or null for a
//     rule that needs the map, held: the line asked is one being moved that is in reduced notation already }. A row with `unless` is off while one of those sets is on. strict (the palette's Strict
//     SBGN): the specification alone, so reduced and fanout are off with it, the rows marked `unless: strict` (what
//     CellDesigner allows beyond it) too, and the rows of the set strict (what it refuses that CellDesigner allows) on.
//   paletteOff(sets) -> { sign: reason }: the palette's signs a set takes away (the CellDesigner compatible tick box).
// RULES is data only, read against the specification line by line: each row a rule, its reason as the editor says it.
// tests/notation.js runs one case per rule; tests/rules-cases/ holds GraphML maps with expected answers, shared with the
// converter's own checks (its tests/rules-cases/, run against its rules.py: two masters, aligned by these cases).
(function (root) {
  'use strict';
  var ARCS = ['consumption', 'production', 'catalysis', 'modulation', 'stimulation', 'inhibition', 'necessary stimulation',
              'logic arc', 'equivalence arc'];
  var MODS = ['catalysis', 'modulation', 'stimulation', 'inhibition', 'necessary stimulation'];
  var INFL = ['modulation', 'stimulation', 'inhibition', 'necessary stimulation'];   // the modulations an influence can be

  // ---------- the accessors: each format's classes to the notation's kinds ----------
  var ENT = function (c) { return { kind: 'entity', cls: c }; }, GATE = function (c) { return { kind: 'gate', cls: c }; };
  var PROC = function (c) { return { kind: 'process', cls: c }; };
  var GRAPHML = {
    Macromolecule: ENT('macromolecule'), SimpleChemical: ENT('simple chemical'), NucleicAcidFeature: ENT('nucleic acid feature'),
    UnspecifiedEntity: ENT('unspecified entity'), Complex: ENT('complex'), EmptySet: ENT('empty set'), SourceAndSink: ENT('empty set'),
    PerturbingAgent: ENT('perturbing agent'), Phenotype: { kind: 'phenotype', cls: 'phenotype' }, Submap: { kind: 'submap', cls: 'submap' },
    Tag: { kind: 'tag', cls: 'tag' }, Compartment: { kind: 'compartment', cls: 'compartment' },
    Process: PROC('process'), OmittedProcess: PROC('omitted process'), UncertainProcess: PROC('uncertain process'),
    Association: PROC('association'), Dissociation: PROC('dissociation')
  };
  var WORD = { AND: 'and', OR: 'or', NOT: 'not', 'τ': 'delay', '≡': 'equivalence' };   // an Operator's label (graphml.py DELAY, EQUIV)
  var SBGNML = {
    macromolecule: ENT('macromolecule'), 'simple chemical': ENT('simple chemical'), 'nucleic acid feature': ENT('nucleic acid feature'),
    'unspecified entity': ENT('unspecified entity'), complex: ENT('complex'), 'empty set': ENT('empty set'), 'source and sink': ENT('empty set'),
    'perturbing agent': ENT('perturbing agent'), 'biological activity': ENT('biological activity'), perturbation: ENT('perturbing agent'),
    phenotype: { kind: 'phenotype', cls: 'phenotype' }, submap: { kind: 'submap', cls: 'submap' }, tag: { kind: 'tag', cls: 'tag' },
    terminal: { kind: 'tag', cls: 'terminal' }, compartment: { kind: 'compartment', cls: 'compartment' },
    process: PROC('process'), 'omitted process': PROC('omitted process'), 'uncertain process': PROC('uncertain process'),
    association: PROC('association'), dissociation: PROC('dissociation'),
    and: GATE('and'), or: GATE('or'), not: GATE('not'), delay: GATE('delay'), equivalence: GATE('equivalence')
  };
  var CELLDESIGNER = {
    PROTEIN: ENT('macromolecule'), RECEPTOR: ENT('macromolecule'), ION_CHANNEL: ENT('macromolecule'), TRUNCATED: ENT('macromolecule'),
    GENE: ENT('nucleic acid feature'), RNA: ENT('nucleic acid feature'), ANTISENSE_RNA: ENT('nucleic acid feature'),
    SIMPLE_MOLECULE: ENT('simple chemical'), ION: ENT('simple chemical'), DRUG: ENT('simple chemical'),
    UNKNOWN: ENT('unspecified entity'), COMPLEX: ENT('complex'), DEGRADED: ENT('empty set'),
    PHENOTYPE: { kind: 'phenotype', cls: 'phenotype' }, COMPARTMENT: { kind: 'compartment', cls: 'compartment' },
    STATE_TRANSITION: PROC('process'), KNOWN_TRANSITION_OMITTED: PROC('omitted process'), UNKNOWN_TRANSITION: PROC('uncertain process'),
    HETERODIMER_ASSOCIATION: PROC('association'), DISSOCIATION: PROC('dissociation'), TRANSPORT: PROC('process'),
    TRANSCRIPTION: PROC('process'), TRANSLATION: PROC('process'), TRUNCATION: PROC('process'),
    BOOLEAN_LOGIC_GATE_AND: GATE('and'), BOOLEAN_LOGIC_GATE_OR: GATE('or'), BOOLEAN_LOGIC_GATE_NOT: GATE('not'),
    BOOLEAN_LOGIC_GATE_UNKNOWN: GATE('equivalence')
  };
  function nodeKind(format, cls, word) {
    if (format === 'graphml') {
      if (cls === 'Operator') { var g = WORD[String(word || '').trim().toUpperCase()] || WORD[String(word || '').trim()]; return g ? GATE(g) : null; }
      return GRAPHML[cls] || null;
    }
    if (format === 'sbgnml') return SBGNML[String(cls || '').replace(/ multimer$/, '')] || null;
    if (format === 'celldesigner') return CELLDESIGNER[cls] || null;
    return null;
  }
  var HEAD = { delta: 'production', white_circle: 'catalysis', t_shape: 'inhibition', white_diamond: 'modulation',
               white_delta: 'stimulation', white_delta_bar: 'necessary stimulation', crows_foot_one: 'inhibition' };   // sbgn_edit ARROW, read back
  function arcHead(format, cls) {   // the arrowhead a GraphML line of that kind is drawn with ('none': a plain line)
    if (format !== 'graphml') return null;
    if (cls === 'inhibition') return 't_shape';
    for (var h in HEAD) if (HEAD[h] === cls) return h;
    return ARCS.indexOf(cls) >= 0 ? 'none' : null;
  }
  var SBGN_ARC = { 'positive influence': 'stimulation', 'negative influence': 'inhibition', 'unknown influence': 'modulation' };
  var CD_ARC = {
    CATALYSIS: 'catalysis', UNKNOWN_CATALYSIS: 'catalysis', INHIBITION: 'inhibition', UNKNOWN_INHIBITION: 'inhibition',
    PHYSICAL_STIMULATION: 'stimulation', MODULATION: 'modulation', TRIGGER: 'necessary stimulation',
    REDUCED_PHYSICAL_STIMULATION: 'stimulation', UNKNOWN_REDUCED_PHYSICAL_STIMULATION: 'stimulation', POSITIVE_INFLUENCE: 'stimulation',
    UNKNOWN_POSITIVE_INFLUENCE: 'stimulation', NEGATIVE_INFLUENCE: 'inhibition', UNKNOWN_NEGATIVE_INFLUENCE: 'inhibition',
    REDUCED_MODULATION: 'modulation', UNKNOWN_REDUCED_MODULATION: 'modulation', REDUCED_TRIGGER: 'necessary stimulation',
    UNKNOWN_REDUCED_TRIGGER: 'necessary stimulation', REACTANT: 'consumption', PRODUCT: 'production'
  };
  function arcKind(format, cls, head) {
    if (format === 'graphml') {
      if (cls === 'none') return head === 'process' ? 'consumption' : head === 'gate' ? 'logic arc' : head === 'tag' ? 'equivalence arc' : head === 'entity' ? 'logic arc' : null;
      return HEAD[cls] || null;
    }
    if (format === 'sbgnml') return ARCS.indexOf(cls) >= 0 ? cls : SBGN_ARC[cls] || null;
    if (format === 'celldesigner') return CD_ARC[cls] || null;
    return null;
  }
  var CD_REDUCED = /\btype="(?:UNKNOWN_)?(?:REDUCED_PHYSICAL_STIMULATION|REDUCED_MODULATION|REDUCED_TRIGGER|NEGATIVE_INFLUENCE|POSITIVE_INFLUENCE)"/;
  function reducedType(format, type) { return format === 'celldesigner' && CD_REDUCED.test('type="' + (type || '') + '"'); }   // a reaction type of reduced notation
  function mapKind(format, text, engines) {
    if (format === 'sbgnml') { var se = engines && engines.sbgn_edit; return se && se.mapKind ? se.mapKind(text) : null; }
    if (format === 'celldesigner') return /<celldesigner:(?:speciesAlias|complexSpeciesAlias)\b/.test(text || '') ? (CD_REDUCED.test(text) ? 'hybrid' : 'pd') : 'empty';
    return null;
  }

  // ---------- the rules ----------
  // A line is allowed when a row of `allow` in a set that is on matches it and no row of `refuse` in a set that is on
  // does; else the first matching refusal's reason, or the arc's own `need`. A side is matched by a list of kinds,
  // 'kind' or 'kind:class' ('entity:empty set'), '*' any. `check` names a rule that needs the map, answered by the
  // caller (ctx.check): gateOneOut (a gate's one line out), oneInput (a NOT gate's or a delay's one input), already (the
  // same line there already), tagRoom (a tag's one line), reversible (a reversible process takes no consumption),
  // oneCatalysis and oneNecessary (a process's one catalysis, its one necessary stimulation), emptyOne (an empty set's one
  // consumption or production); a row with `held` holds only for a line
  // being moved that is in reduced notation already (ctx.held). The audit of every row against the specification and CellDesigner: the viewer's notes/rules-audit.md.
  var RULES = {
    need: {
      consumption: 'A consumption goes from an entity into a process.',
      production: 'A production goes from a process to an entity.',
      catalysis: 'A catalysis goes from an entity to a process.',
      modulation: 'A modulation goes from an entity or a logic gate to a process or a phenotype.',
      stimulation: 'A stimulation goes from an entity or a logic gate to a process or a phenotype.',
      inhibition: 'An inhibition goes from an entity or a logic gate to a process or a phenotype.',
      'necessary stimulation': 'A necessary stimulation goes from an entity or a logic gate to a process or a phenotype.',
      'logic arc': 'A logic arc goes into a logic gate.',
      'equivalence arc': 'A tag is joined to an entity by an equivalence arc.'
    },
    allow: [
      { id: 'consumption', sets: ['house'], arc: ['consumption'], from: ['entity'], to: ['process'], spec: '3.4.1' },
      { id: 'production', sets: ['house'], arc: ['production'], from: ['process'], to: ['entity'], spec: '3.4.1' },
      { id: 'modulation', sets: ['house'], arc: MODS, from: ['entity', 'gate'], to: ['process', 'phenotype'], spec: '3.4.1' },
      { id: 'logic-in', sets: ['house'], arc: ['logic arc'], from: ['entity', 'gate'], to: ['gate'], spec: '3.4.1' },
      { id: 'equivalence-out', sets: ['house'], arc: ['logic arc'], from: ['gate:equivalence'], to: ['entity'], spec: '2.9.4' },
      { id: 'tag', sets: ['house'], arc: ['equivalence arc'], from: ['tag'], to: ['entity'], check: 'tagRoom', spec: '3.4.1' },
      { id: 'tag-in', sets: ['house'], arc: ['equivalence arc'], from: ['entity'], to: ['tag'], check: 'tagRoom', spec: '3.4.1' },
      { id: 'reduced-direct', sets: ['reduced'], arc: INFL, from: ['entity', 'gate'], to: ['entity'],
        why: 'Reduced notation (CellDesigner’s): a modulation may end on an entity.' },
      { id: 'reduced-phenotype', sets: ['reduced'], arc: INFL, from: ['phenotype', 'submap'], to: ['process', 'entity', 'phenotype', 'submap'],
        why: 'CellDesigner has one glyph for phenotype, submap and perturbing agent, with lines both ways.' },
      { id: 'reduced-submap', sets: ['reduced'], arc: INFL, from: ['entity', 'gate'], to: ['submap'],
        why: 'A submap takes a modulation as a phenotype does (CellDesigner’s one glyph).' },
      { id: 'phenotype-species', sets: ['house'], unless: ['strict'], arc: ['consumption'].concat(MODS),
        from: ['phenotype'], to: ['process'], why: 'CellDesigner’s phenotype is a species: a reaction’s reactant or modifier.' },
      { id: 'phenotype-product', sets: ['house'], unless: ['strict'], arc: ['production'], from: ['process'], to: ['phenotype'],
        why: 'CellDesigner’s phenotype is a species: a reaction’s product.' },
      { id: 'af-influence', sets: ['af'], arc: INFL, from: ['entity', 'gate'], to: ['entity', 'phenotype'], spec: 'AF 3.3' },
      { id: 'reduced-held', sets: ['house'], arc: INFL, from: ['entity', 'gate', 'phenotype', 'submap'], to: ['entity'], held: true,
        why: 'A line the map already has in reduced notation may be moved; a new one is drawn only with Reduced notation ticked.' }
    ],
    refuse: [
      { id: 'gate-one-out', sets: ['house'], arc: ['*'], from: ['gate:not', 'gate:delay', 'gate:equivalence'], to: ['*'], check: 'gateOneOut', spec: '3.4.1' },
      { id: 'gate-one-out-and-or', sets: ['house'], unless: ['fanout'], arc: ['*'], from: ['gate:and', 'gate:or'], to: ['*'], check: 'gateOneOut', spec: '3.4.1',
        why: 'With the proposed set fanout on, an AND or OR gate may have several lines out (demerging links, not yet in SBGN).' },
      { id: 'one-input', sets: ['house'], arc: ['*'], from: ['*'], to: ['gate:not', 'gate:delay'], check: 'oneInput' },
      { id: 'already', sets: ['house'], arc: ['*'], from: ['*'], to: ['*'], check: 'already' },
      { id: 'reversible', sets: ['pd'], arc: ['consumption'], from: ['*'], to: ['process'], check: 'reversible', spec: '3.5.2.5' },
      { id: 'empty-set-from', sets: ['pd'], arc: ['production', 'logic arc', 'equivalence arc'].concat(MODS),
        from: ['entity:empty set'], to: ['*'], no: 'An empty set is only consumed or produced.', spec: '3.4.1',
        why: 'Kept in the default set though CellDesigner takes a degraded species as a modifier: it carries no information there.' },
      { id: 'empty-set-to', sets: ['pd'], arc: ['consumption', 'catalysis', 'modulation', 'stimulation', 'inhibition', 'necessary stimulation', 'logic arc', 'equivalence arc'],
        from: ['*'], to: ['entity:empty set'], no: 'An empty set is only consumed or produced.', spec: '3.4.1' },
      { id: 'agent-from', sets: ['pd'], arc: ['consumption', 'production', 'catalysis', 'logic arc'], from: ['entity:perturbing agent'], to: ['*'],
        no: 'A perturbing agent only starts a modulation, stimulation, inhibition or necessary stimulation.', spec: '3.4.1' },
      { id: 'agent-to', sets: ['pd'], arc: ['*'], from: ['*'], to: ['entity:perturbing agent'],
        no: 'A perturbing agent only starts a modulation, stimulation, inhibition or necessary stimulation.', spec: '3.4.1' },
      { id: 'nucleic-catalyst', sets: ['strict'], why: 'CellDesigner takes a gene or an RNA as a catalysis.', arc: ['catalysis'], from: ['entity:nucleic acid feature'], to: ['*'], no: 'A nucleic acid feature is no catalyst.', spec: '3.4.1' },
      { id: 'catalysis-ends', sets: ['pd'], arc: ['catalysis'], from: ['submap'], to: ['*'], no: 'A catalysis goes from an entity to a process.', spec: '3.4.1' },
      { id: 'phenotype-catalyst', sets: ['strict'], arc: ['catalysis'], from: ['phenotype'], to: ['*'], no: 'A catalysis goes from an entity to a process.', spec: '3.4.1',
        why: 'CellDesigner takes a phenotype as a catalysis.' },
      { id: 'catalysis-submap', sets: ['pd'], arc: ['catalysis'], from: ['*'], to: ['submap'], no: 'A catalysis goes from an entity to a process.', spec: '3.4.1' },
      { id: 'one-catalysis', sets: ['strict'], arc: ['catalysis'], from: ['*'], to: ['process'], check: 'oneCatalysis', spec: '3.5.2.4' },
      { id: 'one-necessary', sets: ['strict'], arc: ['necessary stimulation'], from: ['*'], to: ['process'], check: 'oneNecessary', spec: '3.5.2.4' },
      { id: 'empty-set-one-out', sets: ['strict'], arc: ['consumption'], from: ['entity:empty set'], to: ['*'], check: 'emptyOne', spec: '3.4.1' },
      { id: 'empty-set-one-in', sets: ['strict'], arc: ['production'], from: ['*'], to: ['entity:empty set'], check: 'emptyOne', spec: '3.4.1' },
      { id: 'equivalence-entities', sets: ['house'], arc: ['logic arc'], from: ['gate:equivalence'], to: ['gate'], no: 'An equivalence joins entities only.', spec: '2.9.4' },
      { id: 'into-equivalence', sets: ['house'], arc: ['logic arc'], from: ['gate'], to: ['gate:equivalence'], no: 'An equivalence joins entities only.', spec: '2.9.4' },
      { id: 'equivalence-line', sets: ['house'], arc: MODS, from: ['gate:equivalence'], to: ['*'], no: 'An equivalence’s line goes to an entity.', spec: '2.9.4' }
    ],
    palette: [
      { sign: 'tag', sets: ['cd'], no: 'CellDesigner has no tag or submap terminal.' },
      { sign: 'delay', sets: ['cd'], no: 'CellDesigner has no delay; the converter joins its input to its target.' }
    ]
  };

  function side(list, k) {
    if (!k) return false;
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (w === '*' || w === k.kind || w === k.kind + ':' + k.cls) return true;
    }
    return false;
  }
  function on(row, sets) { return !(row.unless || []).some(function (s) { return sets.indexOf(s) >= 0; }) && row.sets.some(function (s) { return s === 'house' || sets.indexOf(s) >= 0; }); }
  function fits(row, arc, from, to) { return (row.arc.indexOf('*') >= 0 || row.arc.indexOf(arc) >= 0) && side(row.from, from) && side(row.to, to); }
  function allowed(arc, from, to, ctx) {
    ctx = ctx || {};
    var sets = ctx.sets || ['pd'], check = ctx.check || function () { return null; }, i, r, why;
    if (ARCS.indexOf(arc) < 0) return 'Not a line of the notation.';
    if (sets.indexOf('strict') >= 0) sets = sets.filter(function (x) { return x !== 'reduced' && x !== 'fanout'; });   // the specification alone
    for (i = 0; i < RULES.refuse.length; i++) {
      r = RULES.refuse[i];
      if (!on(r, sets) || !fits(r, arc, from, to)) continue;
      why = r.check ? check(r.check) : r.no;
      if (why) return why;
    }
    for (i = 0; i < RULES.allow.length; i++) {
      r = RULES.allow[i];
      if (!on(r, sets) || (r.held && !ctx.held) || !fits(r, arc, from, to)) continue;
      return r.check ? check(r.check) : null;
    }
    return RULES.need[arc];
  }
  function paletteOff(sets) {
    var o = {};
    RULES.palette.forEach(function (r) { if (r.sets.some(function (s) { return (sets || []).indexOf(s) >= 0; })) o[r.sign] = r.no; });
    return o;
  }

  var api = { ARCS: ARCS, MODS: MODS, RULES: RULES, nodeKind: nodeKind, arcKind: arcKind, arcHead: arcHead, reducedType: reducedType, mapKind: mapKind, allowed: allowed, paletteOff: paletteOff };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.notation = api;
})(typeof self !== 'undefined' ? self : this);
