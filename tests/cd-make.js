// cd_make: CellDesigner maps made and changed by text, checked three ways.
// 1. From an empty map: every palette class, a compartment holding species, a complex with members, every reaction,
//    added reactant and product, modifier, reduced notation and gate kind (on a reaction and between entities, NOT with
//    one input), residues, structural state, unit of information, multimer, renames (a line break, special characters,
//    onto another protein's name), retypes, refusals with their reasons (twin lines, lines to a complex's member) and
//    removals (cascading ones too); last, everything removed gives the empty map back byte for byte. Then the classes
//    outside the palette (a small file made so) retyped, and a species beyond the map's size.
//    After every step: cdrender draws it with no error, cd_edit.graphml reads it, its cross-references hold (refs():
//    nothing new broken), and the converter's celldesigner.read finds what the step made (its nodes by kind and its arcs
//    by head, as a change from the step before).
// 2. On every demo map: a species, a reaction to an existing one and a modifier added, an existing species renamed (a
//    line break, special characters) and named back, the new species removed: the text is the original byte for byte;
//    each step changes no original line but the ones it means to, and reads as in 1. Existing species, complexes and
//    compartments removed and retyped; gates added and removed on three maps; the same on one map written on one line
//    and with CRLF line ends.
// 3. Gate placement: the gates CellDesigner 4.4 placed in the gate cases, made again on the file before them;
//    each within TOL of CellDesigner's place, on the same side of the reaction.
//   node tests/cd-make.js [python] [gate cases folder]   (default python3; the folder, also CD_GATE_CASES, holds
//   gate-cases-v03.xml and gate-cases-placed-v01.xml; part 3 is skipped without it)
var fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
var here = path.join(__dirname, '..'), conv = path.join(here, 'renderers/converter');
var mk = require(path.join(conv, 'cd_make.js')), cdr = require(path.join(conv, 'cdrender.js')), ed = require(path.join(conv, 'cd_edit.js'));
var DP = require('@xmldom/xmldom').DOMParser, opt = { DOMParser: DP };
var args = process.argv.slice(2), py = args[0] && !fs.existsSync(args[0]) ? args.shift() : 'python3', cases = args[0] || process.env.CD_GATE_CASES;
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-make-')), bad = 0, reads = [];
function fault(s) { bad++; console.log('FAIL', s); }

// the file's cross-references as CellDesigner needs them: ids once; every alias's species, compartment and complex there,
// every species with an alias; references named and there; a reaction's ends and SBML references there, its modifiers each
// with one modifierSpeciesReference and in the species' listOfCatalyzedReactions, a gate's inputs each with one own line;
// residue states on the protein's residues. A list of what is broken
function refs(t) {
  var d = new DP().parseFromString(t, 'application/xml'), out = [], E = function (n, el) { return Array.prototype.slice.call((el || d).getElementsByTagName(n)); };
  var g = function (e, k) { return e.getAttribute(k); }, by = function (n) { var o = {}; E(n).forEach(function (e) { o[g(e, 'id')] = e; }); return o; };
  var sp = by('species'), inc = by('celldesigner:species'), comp = by('compartment'), rx = by('reaction'), al = {}, seen = {}, refd = {}, used = {}, has = {};
  [sp, comp, rx, inc].forEach(function (o) { Object.keys(o).forEach(function (k) { if (seen[k]) out.push('id twice ' + k); seen[k] = 1; }); });
  ['speciesAlias', 'complexSpeciesAlias', 'compartmentAlias'].forEach(function (n) { E('celldesigner:' + n).forEach(function (e) { if (al[g(e, 'id')]) out.push('alias twice ' + g(e, 'id')); al[g(e, 'id')] = e; }); });
  Object.keys(al).forEach(function (k) {
    var e = al[k], s = g(e, 'species'), ca = g(e, 'compartmentAlias'), cx = g(e, 'complexSpeciesAlias');
    if (s) { has[s] = 1; if (!sp[s] && !inc[s]) out.push(k + ': no species ' + s); }
    if (g(e, 'compartment') && !comp[g(e, 'compartment')]) out.push(k + ': no compartment');
    if (ca && !al[ca] || cx && !al[cx]) out.push(k + ': no alias it is in');
  });
  Object.keys(sp).concat(Object.keys(inc)).forEach(function (s) { if (!has[s]) out.push('species with no alias ' + s); });
  Object.keys(sp).forEach(function (s) { if (!comp[g(sp[s], 'compartment')]) out.push(s + ': no compartment'); });
  Object.keys(comp).forEach(function (c) { if (g(comp[c], 'outside') && !comp[g(comp[c], 'outside')]) out.push(c + ': no outside'); });
  ['protein', 'gene', 'RNA', 'AntisenseRNA'].forEach(function (n) { E('celldesigner:' + n).forEach(function (e) { refd[g(e, 'id')] = e; }); });
  ['protein', 'gene', 'rna', 'antisenserna'].forEach(function (n) { E('celldesigner:' + n + 'Reference').forEach(function (e) { used[e.textContent] = 1; if (!refd[e.textContent]) out.push('no reference ' + e.textContent); }); });
  Object.keys(refd).forEach(function (r) { if (!used[r]) out.push('reference unused ' + r); });
  Object.keys(rx).forEach(function (r) {
    var e = rx[r], mods = E('celldesigner:modification', e), plain = mods.filter(function (m) { return !/^BOOLEAN/.test(g(m, 'type')); });
    E('speciesReference', e).concat(E('modifierSpeciesReference', e)).forEach(function (s) { var a = E('celldesigner:alias', s)[0]; if (!sp[g(s, 'species')] || a && !al[a.textContent]) out.push(r + ': SBML reference to nothing'); });
    ['baseReactant', 'baseProduct', 'reactantLink', 'productLink'].forEach(function (n) { E('celldesigner:' + n, e).forEach(function (b) { if (!al[g(b, 'alias')]) out.push(r + ': ' + n + ' to nothing'); }); });
    plain.forEach(function (m) {
      if (!al[g(m, 'aliases')]) out.push(r + ': modifier to nothing');
      var s = sp[g(m, 'modifiers')];
      if (s && !E('celldesigner:catalyzed', s).some(function (c) { return g(c, 'reaction') === r; })) out.push(r + ': modifier ' + g(m, 'modifiers') + ' not in listOfCatalyzedReactions');
    });
    if (E('modifierSpeciesReference', e).length !== plain.length) out.push(r + ': ' + plain.length + ' modifiers, ' + E('modifierSpeciesReference', e).length + ' SBML references');
    mods.filter(function (m) { return /^BOOLEAN/.test(g(m, 'type')); }).forEach(function (m) {
      var as = g(m, 'aliases').split(','), ms = g(m, 'modifiers').split(',');
      as.forEach(function (a, i) {
        if (!al[a] || g(al[a], 'species') !== ms[i]) out.push(r + ': gate input ' + a + ' wrong');
        if (plain.filter(function (o) { return g(o, 'aliases') === a && g(o, 'type') === g(m, 'modificationType'); }).length !== 1) out.push(r + ': gate input ' + a + ' not one own line');
      });
    });
    E('celldesigner:GateMember', e).forEach(function (m) { g(m, 'aliases').split(',').forEach(function (a) { if (!al[a]) out.push(r + ': gate member to nothing'); }); });
  });
  E('celldesigner:catalyzed').forEach(function (c) { if (!rx[g(c, 'reaction')]) out.push('catalyzed of no reaction ' + g(c, 'reaction')); });
  E('celldesigner:modification').forEach(function (m) {
    var res = g(m, 'residue'), s = m.parentNode;
    if (!res) return;
    while (s && !/^(celldesigner:)?species$/.test(s.nodeName)) s = s.parentNode;
    var pr = E('celldesigner:proteinReference', s)[0], P = pr && refd[pr.textContent];
    if (!P || !E('celldesigner:modificationResidue', P).some(function (x) { return g(x, 'id') === res; })) out.push('residue state ' + res + ' on no residue of ' + g(s, 'id'));
  });
  return out;
}
var base = {};
// a step's text: drawn by cdrender with no error, read by cd_edit, valid XML; queued for the converter with the change
// it should find (from the step before in the same chain)
function check(tag, t, delta, chain) {
  var errs = [];
  new DP({ onError: function (l, m) { if (l !== 'warning') errs.push('XML: ' + m); } }).parseFromString(t, 'application/xml');
  try { cdr.render(t, { DOMParser: DP, log: function (s) { errs.push('cdrender: ' + s); } }); } catch (e) { errs.push('cdrender: ' + e.message); }
  try { ed.graphml(t, null, opt); } catch (e) { errs.push('cd_edit.graphml: ' + e.message); }
  var now = refs(t), was = base[chain] = base[chain] || new Set(now);
  now.forEach(function (e) { if (!was.has(e)) errs.push('refs: ' + e); });
  if (errs.length) fault(tag + ': ' + errs.slice(0, 3).join(' | '));
  var f = path.join(tmp, reads.length + '.xml');
  fs.writeFileSync(f, t);
  reads.push({ tag: tag, f: f, delta: delta === undefined ? {} : delta, chain: chain });
}
function refused(tag, fn, re) { try { fn(); fault(tag + ': not refused'); } catch (e) { if (!re.test(e.message)) fault(tag + ': refused with "' + e.message + '"'); } }

// ---- 1. from an empty map ----
var E0 = mk.empty({ W: 2000, H: 1600 }), t = E0, r, A = {}, chain = 'empty';
check('empty', t, {}, chain);
function step(tag, f, delta) { var out = f(t); t = typeof out === 'string' ? out : out.text; check(tag, t, delta, chain); return out; }
function sp(key, o, delta) { var out = step('species ' + key, function (x) { return mk.species(x, o); }, delta); A[key] = out.alias; return out; }
var cmp = step('compartment', function (x) { return mk.compartment(x, { name: 'cell', box: [20, 20, 1900, 1500] }); }, { Compartment: 1 }).alias;
var KIND = { PROTEIN: 'Macromolecule', GENE: 'NucleicAcidFeature', RNA: 'NucleicAcidFeature', SIMPLE_MOLECULE: 'SimpleChemical', UNKNOWN: 'UnspecifiedEntity',
  PHENOTYPE: 'Phenotype', DEGRADED: 'EmptySet', COMPLEX: 'Complex' };
Object.keys(KIND).forEach(function (cls, k) { var d = {}; d[KIND[cls]] = 1; sp(cls, { cls: cls, name: cls.toLowerCase() + ' α-1', box: [60 + 200 * k, 60], compartment: k % 2 ? cmp : null }, d); });
sp('m1', { cls: 'PROTEIN', name: 'member one', box: [1475, 75], complex: A.COMPLEX }, { Macromolecule: 1 });
sp('m2', { cls: 'SIMPLE_MOLECULE', name: 'member two', box: [1480, 130], complex: A.COMPLEX }, { SimpleChemical: 1 });
['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].forEach(function (n, k) { sp(n, { cls: 'PROTEIN', name: n, box: [60 + 150 * (k % 6), 400 + 300 * Math.floor(k / 6)], compartment: cmp }, { Macromolecule: 1 }); });
sp('a2', { cls: 'PROTEIN', name: 'a', box: [1000, 400] }, { Macromolecule: 1 });   // another species of a's protein
if ((t.match(/<celldesigner:protein id="[^"]*" name="a"/g) || []).length !== 1) fault('a protein of the same name: not shared');
var R1 = step('reaction', function (x) { return mk.reaction(x, { from: A.a, to: A.b }); }, { Process: 1, line: 1, production: 1 }).reaction;
var R2 = step('omitted', function (x) { return mk.reaction(x, { type: 'KNOWN_TRANSITION_OMITTED', from: A.c, to: A.d }); }, { OmittedProcess: 1, line: 1, production: 1 }).reaction;
var R3 = step('uncertain', function (x) { return mk.reaction(x, { type: 'UNKNOWN_TRANSITION', from: A.e, to: A.f }); }, { UncertainProcess: 1, line: 1, production: 1 }).reaction;
step('reactant', function (x) { return mk.reactant(x, R1, A.SIMPLE_MOLECULE); }, { line: 1 });
step('product', function (x) { return mk.product(x, R1, A.DEGRADED); }, { production: 1 });
var HEAD = { CATALYSIS: 'catalysis', INHIBITION: 'inhibition', PHYSICAL_STIMULATION: 'stimulation', MODULATION: 'modulation', TRIGGER: 'trigger' };
['CATALYSIS', 'INHIBITION', 'PHYSICAL_STIMULATION', 'MODULATION', 'TRIGGER'].forEach(function (type, k) {
  var d = {}; d[HEAD[type]] = 1;
  step('modifier ' + type, function (x) { return mk.modifier(x, R1, [A.g, A.h, A.i, A.GENE, A.RNA][k], type); }, d);
});
var RED = { NEGATIVE_INFLUENCE: 'inhibition', REDUCED_PHYSICAL_STIMULATION: 'stimulation', REDUCED_MODULATION: 'modulation', REDUCED_TRIGGER: 'trigger' };
Object.keys(RED).forEach(function (type, k) { var d = {}; d[RED[type]] = 1; step('reduced ' + type, function (x) { return mk.reduced(x, { type: type, from: [A.j, A.k, A.l, A.UNKNOWN, A.c][k], to: A.PHENOTYPE }); }, d); });
refused('a positive influence (not SBGN)', function () { mk.reduced(t, { type: 'POSITIVE_INFLUENCE', from: A.j, to: A.PHENOTYPE }); }, /not offered/);
(function () {   // CellDesigner's open arrowhead taken in as the open triangle: reaction type, gate output and its inputs' lines
  var x = '<celldesigner:reactionType>POSITIVE_INFLUENCE</celldesigner:reactionType><celldesigner:GateMember type="BOOLEAN_LOGIC_GATE_AND" modificationType="POSITIVE_INFLUENCE"/><celldesigner:GateMember type="POSITIVE_INFLUENCE"/><celldesigner:reactionType>UNKNOWN_POSITIVE_INFLUENCE</celldesigner:reactionType><celldesigner:reactionType>\n  POSITIVE_INFLUENCE\n</celldesigner:reactionType><species name="POSITIVE_INFLUENCE"><notes><p>POSITIVE_INFLUENCE</p></notes></species>';
  var r = mk.sbgn(x);
  if (r.n !== 4 || r.text.split('POSITIVE_INFLUENCE').length !== 4 || r.text.indexOf('UNKNOWN_POSITIVE_INFLUENCE') < 0 || mk.sbgn(t).n !== 0) fault('sbgn: positive influence not taken in as the open triangle (' + r.n + ')');
})();
var gates = {};
[['AND', [A.g, A.h], R2, 'CATALYSIS'], ['OR', [A.i, A.j], R3, 'INHIBITION'], ['NOT', [A.k], R2, 'TRIGGER'], ['UNKNOWN', [A.l, A.a], R3, 'MODULATION']].forEach(function (q) {
  var d = { Operator: 1, line: q[1].length }; d[HEAD[q[3]]] = 1;
  gates[q[0]] = step('gate ' + q[0] + ' on a reaction', function (x) { return mk.gate(x, { kind: q[0], inputs: q[1], target: q[2], output: q[3] }); }, d).gate;
});
[['AND', [A.a, A.b], A.e, 'REDUCED_TRIGGER'], ['OR', [A.c, A.d], A.f, 'NEGATIVE_INFLUENCE'], ['NOT', [A.g], A.h, 'REDUCED_MODULATION'], ['UNKNOWN', [A.i, A.j], A.k, 'REDUCED_PHYSICAL_STIMULATION']].forEach(function (q) {
  var d = { Operator: 1, line: q[1].length }; d[RED[q[3]]] = 1;
  gates['r' + q[0]] = step('gate ' + q[0] + ' between entities', function (x) { return mk.gate(x, { kind: q[0], inputs: q[1], target: q[2], output: q[3] }); }, d).gate;
});
(function () {   // a file with open arrowheads (reduced and a gate's output) taken in: read by cdrender and cd_edit, all now the open triangle
  var y = t.replace(/(["'>])NEGATIVE_INFLUENCE(?=["'<])/g, '$1POSITIVE_INFLUENCE'), r = mk.sbgn(y), errs = [];
  try { cdr.render(r.text, { DOMParser: DP, log: function (s) { errs.push(s); } }); ed.graphml(r.text, null, opt); } catch (e) { errs.push(e.message); }
  if (r.n < 3 || errs.length || r.text.split('REDUCED_PHYSICAL_STIMULATION').length - y.split('REDUCED_PHYSICAL_STIMULATION').length !== r.n) fault('sbgn on a whole file: ' + r.n + ' ' + errs.join('; '));
})();
var before = t;
step('gate input on a reaction', function (x) { return mk.gateInput(x, gates.OR, A.l); }, { line: 1 });
step('gate input between entities', function (x) { return mk.gateInput(x, gates.rOR, A.l); }, { line: 1 });
step('gate input off a reaction', function (x) { return mk.gateInputRemove(x, gates.OR, A.l); }, { line: -1 });
step('gate input off between entities', function (x) { return mk.gateInputRemove(x, gates.rOR, A.l); }, { line: -1 });
if (t !== before) fault('gate inputs added and removed: not the text as it was');
refused('AND with one input', function () { mk.gate(t, { kind: 'AND', inputs: [A.a], target: R1 }); }, /an AND gate needs two inputs/i);
refused('an input twice as a modifier of one type', function () { mk.gate(t, { kind: 'OR', inputs: [A.g, A.b], target: R1, output: 'CATALYSIS' }); }, /could not be told apart/);
refused('a gate output not offered', function () { mk.gate(t, { kind: 'OR', inputs: [A.b, A.c], target: A.d, output: 'CATALYSIS' }); }, /not a reduced notation type/);
// twin lines and lines to a complex's member, refused
refused('a second plain modifier of one type', function () { mk.modifier(t, R1, A.g, 'CATALYSIS'); }, /could not be told apart/);
var mg = step('a plain modifier from an input of the AND gate', function (x) { return mk.modifier(x, R2, A.g, 'INHIBITION'); }, { inhibition: 1 }).part;
refused('its type made the gate\'s output', function () { mk.modifierType(t, R2, +mg.slice(1), 'CATALYSIS'); }, /could not be told apart/);
refused('the gate\'s output made its type', function () { mk.gateType(t, gates.AND, { output: 'INHIBITION' }); }, /could not be told apart/);
step('the plain modifier removed', function (x) { return mk.removeLine(x, R2, mg); }, { inhibition: -1 });
[['reaction', function () { mk.reaction(t, { from: A.m1, to: A.a }); }], ['reduced link', function () { mk.reduced(t, { type: 'NEGATIVE_INFLUENCE', from: A.a, to: A.m1 }); }],
  ['modifier', function () { mk.modifier(t, R1, A.m1, 'TRIGGER'); }], ['added reactant', function () { mk.reactant(t, R1, A.m1); }],
  ['gate input', function () { mk.gateInput(t, gates.rOR, A.m1); }], ['gate', function () { mk.gate(t, { kind: 'NOT', inputs: [A.m2], target: A.a }); }]]
  .forEach(function (q) { refused(q[0] + ' to a complex\'s member', q[1], /joins the complex, not one of its members/); });
refused('a line on a missing reaction', function () { mk.removeLine(t, 're99'); }, /No reaction re99 on the map/);
// residues, structural state, unit of information, multimer
step('residue', function (x) { return mk.residue(x, A.a, { name: 'S15', state: 'phosphorylated' }); }, {});
step('second residue', function (x) { return mk.residue(x, A.a, { state: 'ubiquitinated' }); }, {});
step('residue on another species of the protein', function (x) { return mk.residueState(x, A.a2, 0, 'acetylated'); }, {});
step('residue state', function (x) { return mk.residueState(x, A.a, 1, 'empty'); }, {});
refused('a residue state outside the list', function () { mk.residue(t, A.a, { state: 'oxidised' }); }, /no residue state oxidised/);
refused('a residue on a gene', function () { mk.residue(t, A.GENE, { state: 'phosphorylated' }); }, /Residues belong to proteins; this is a gene\./);
step('structural state', function (x) { return mk.structural(x, A.b, 'active'); }, {});
refused('a second structural state', function () { mk.structural(t, A.b, 'cAMP'); }, /already has a structural state/);
step('structural state replaced', function (x) { return mk.structural(x, A.b, 'cAMP', true); }, {});
step('unit of information', function (x) { return mk.info(x, A.GENE, 'ct:gene'); }, {});
refused('a second unit of information', function () { mk.info(t, A.GENE, 'free text'); }, /already has a unit of information/);
step('unit of information, free text', function (x) { return mk.info(x, A.c, 'free text & more'); }, {});
step('multimer 2', function (x) { return mk.homodimer(x, A.d, 2); }, {});
step('multimer 3', function (x) { return mk.homodimer(x, A.d, 3); }, {});
// renames and retypes
step('rename protein', function (x) { return mk.rename(x, A.a, 'PKA cat/β'); }, {});
step('rename complex', function (x) { return mk.rename(x, A.COMPLEX, 'the complex'); }, {});
step('rename member', function (x) { return mk.rename(x, A.m2, 'cAMP'); }, {});
step('rename compartment', function (x) { return mk.rename(x, cmp, 'cytosol'); }, {});
step('rename metabolite', function (x) { return mk.rename(x, A.SIMPLE_MOLECULE, 'ATP'); }, {});
var odd = 'two\nlines & "q" <x>';
step('rename with a line break and special characters', function (x) { return mk.rename(x, A.c, odd); }, {});
var named = new DP().parseFromString(t, 'application/xml').getElementsByTagName('celldesigner:protein');
if (!Array.prototype.some.call(named, function (e) { return e.getAttribute('name') === 'two_br_lines_space_&_space_"q"_space_<x>'; })) fault('a name with a line break: not written as CellDesigner\'s _br_');
sp('x1', { cls: 'PROTEIN', name: 'xx', box: [1200, 900] }, { Macromolecule: 1 });
sp('x2', { cls: 'PROTEIN', name: 'yy', box: [1300, 900] }, { Macromolecule: 1 });
step('rename onto another protein\'s name (joins it)', function (x) { return mk.rename(x, A.x2, 'xx'); }, {});
if (/name="yy"/.test(t) || (t.match(/<celldesigner:protein [^>]*name="xx"/g) || []).length !== 1) fault('rename onto another protein\'s name: not one protein of that name');
step('retype protein to gene', function (x) { return mk.retype(x, A.b, 'GENE'); }, { Macromolecule: -1, NucleicAcidFeature: 1 });
step('retype gene to RNA', function (x) { return mk.retype(x, A.b, 'RNA'); }, {});
step('retype RNA to simple molecule', function (x) { return mk.retype(x, A.b, 'SIMPLE_MOLECULE'); }, { NucleicAcidFeature: -1, SimpleChemical: 1 });
step('retype back to protein', function (x) { return mk.retype(x, A.b, 'PROTEIN'); }, { SimpleChemical: -1, Macromolecule: 1 });
step('retype a protein with residue states (they stay on the protein)', function (x) { return mk.retype(x, A.a2, 'GENE'); }, { Macromolecule: -1, NucleicAcidFeature: 1 });
if (!/<celldesigner:protein id="[^"]*" name="PKA_space_cat_slash__beta_" type="GENERIC">/.test(t)) fault('retype: the protein lost its residues or name');
step('retyped back: the protein of its name again', function (x) { return mk.retype(x, A.a2, 'PROTEIN'); }, { Macromolecule: 1, NucleicAcidFeature: -1 });
if ((t.match(/<celldesigner:gene id=/g) || []).length !== 1) fault('retype back: the unused gene reference not removed');
step('retype member', function (x) { return mk.retype(x, A.m1, 'UNKNOWN'); }, { Macromolecule: -1, UnspecifiedEntity: 1 });
refused('retype to complex', function () { mk.retype(t, A.a, 'COMPLEX'); }, /complex and a single species/);
refused('retype a complex', function () { mk.retype(t, A.COMPLEX, 'PROTEIN'); }, /complex and a single species/);
step('reaction type', function (x) { return mk.reactionType(x, R1, 'UNKNOWN_TRANSITION'); }, { Process: -1, UncertainProcess: 1 });
refused('reaction to reduced type', function () { mk.reactionType(t, R1, 'NEGATIVE_INFLUENCE'); }, /cannot become NEGATIVE_INFLUENCE/);
step('modifier type', function (x) { return mk.modifierType(x, R1, 0, 'INHIBITION'); }, { catalysis: -1, inhibition: 1 });
step('gate kind', function (x) { return mk.gateType(x, gates.AND, { kind: 'OR' }); }, {});
step('gate output', function (x) { return mk.gateType(x, gates.AND, { output: 'PHYSICAL_STIMULATION' }); }, { catalysis: -1, stimulation: 1 });
step('gate output between entities', function (x) { return mk.gateType(x, gates.rAND, { output: 'NEGATIVE_INFLUENCE' }); }, { trigger: -1, inhibition: 1 });
refused('NOT gate made AND with one input', function () { mk.gateType(t, gates.NOT, { kind: 'AND' }); }, /an AND gate needs two inputs/i);
// removals
refused('a compartment that holds species', function () { mk.remove(t, [cmp]); }, /still holds other things/);
var inner = step('a compartment inside another', function (x) { return mk.compartment(x, { name: 'nucleus', box: [1500, 1200, 300, 200] }); }, { Compartment: 1 }).alias;
if (!/<compartment metaid="c2" id="c2" name="nucleus" size="1" units="volume" outside="c1">/.test(t)) fault('a compartment inside another: not outside="c1"');
refused('a compartment holding a compartment', function () { mk.remove(t, rest0()); }, /still holds other things/);
step('remove the inner compartment', function (x) { return mk.remove(x, [inner]); }, { Compartment: -1 });
step('remove a modifier', function (x) { return mk.removeLine(x, R1, 'm4'); }, { trigger: -1 });
step('remove the added reactant', function (x) { return mk.removeLine(x, R1, 'r0'); }, { line: -1 });
step('remove the added product', function (x) { return mk.removeLine(x, R1, 'p0'); }, { production: -1 });
step('remove an input of a two-input gate (the gate goes)', function (x) { return mk.removeLine(x, R2, 'm1'); }, { Operator: -1, line: -2, stimulation: -1 });
step('remove a NOT gate', function (x) { return mk.removeLine(x, R2, 'm0'); }, { Operator: -1, line: -1, trigger: -1 });
step('remove an entity: its reactions, modifiers, gate inputs', function (x) { return mk.remove(x, [A.a]); },
  { Macromolecule: -1, UncertainProcess: -1, line: -4, production: -1, inhibition: -3, stimulation: -1, modulation: -1, Operator: -1 });   // the AND between
// entities loses an input it needs and goes; the unknown gate on a reaction keeps its other one
step('remove a complex with its members', function (x) { return mk.remove(x, [A.COMPLEX]); }, { Complex: -1, UnspecifiedEntity: -1, SimpleChemical: -1 });
step('remove a gate input between entities (the gate goes)', function (x) { return mk.remove(x, [A.g]); }, { Macromolecule: -1, Operator: -1, line: -1, modulation: -1 });
step('multimer 1', function (x) { return mk.homodimer(x, A.d, 1); }, {});
step('residue removed', function (x) { return mk.residueRemove(x, A.a2, 1); }, {});
step('unit of information removed', function (x) { return mk.info(x, A.c, null); }, {});
step('structural state removed', function (x) { return mk.structural(x, A.b, null); }, {});
function rest0() { return (t.match(/<celldesigner:(?:speciesAlias|complexSpeciesAlias) id="[^"]*"/g) || []).map(function (s) { return /id="([^"]*)"/.exec(s)[1]; }).concat([cmp]); }
var rest = (t.match(/<celldesigner:(?:speciesAlias|complexSpeciesAlias) id="[^"]*"/g) || []).map(function (s) { return /id="([^"]*)"/.exec(s)[1]; });
step('remove everything left', function (x) { return mk.remove(x, rest); }, null);
step('remove the compartment', function (x) { return mk.remove(x, [cmp]); }, null);
if (t !== E0) fault('everything removed: not the empty map, ' + t.length + ' bytes for ' + E0.length);
// a species beyond the map: the map grows (as CellDesigner's own), and stays so when it goes
chain = 'beyond'; t = E0;
var far = step('a species beyond the map', function (x) { return mk.species(x, { cls: 'PROTEIN', name: 'far', box: [2100, 1700] }); }, null);
if (!/<celldesigner:modelDisplay sizeX="2220" sizeY="1780"\/>/.test(t)) fault('a species beyond the map: the map not grown');
step('and removed', function (x) { return mk.remove(x, [far.alias]); }, null);
if (t !== E0.replace('sizeX="2000" sizeY="1600"', 'sizeX="2220" sizeY="1780"')) fault('a species beyond the map removed: not the map as it was, grown');
// classes outside the palette (receptor, ion channel, truncated protein, ion, drug), made so by hand: retyped into the
// palette, residues on the protein kinds, their references and colours
// compartments drawn round what is there take it in (membership follows the boxes): species, a complex with its member,
// a compartment, the ones held by the new compartment's own holder; a species drawn later goes into the one round it
chain = 'drawn round'; t = E0;
function inComp(x, a) {   // [the alias's compartmentAlias, its species' compartment]
  var tag = x.match(new RegExp('<celldesigner:(?:speciesAlias|complexSpeciesAlias) id="' + a + '"[^>]*>'))[0], sid = /species="([^"]*)"/.exec(tag)[1];
  var st = x.match(new RegExp('<species metaid="' + sid + '"[^>]*>'));
  return [(/compartmentAlias="([^"]*)"/.exec(tag) || [])[1] || null, st ? /compartment="([^"]*)"/.exec(st[0])[1] : null];
}
var D = {};
['p1', 'p2', 'p3'].forEach(function (k, i) { D[k] = step('drawn round: species ' + k, function (x) { return mk.species(x, { cls: 'PROTEIN', name: k, box: [100 + 200 * i, 100] }); }, { Macromolecule: 1 }).alias; });
D.cx = step('drawn round: a complex', function (x) { return mk.species(x, { cls: 'COMPLEX', name: 'cx', box: [100, 300] }); }, { Complex: 1 }).alias;
D.m = step('drawn round: its member', function (x) { return mk.species(x, { cls: 'PROTEIN', name: 'm', box: [110, 320], complex: D.cx }); }, { Macromolecule: 1 }).alias;
var inner = step('drawn round: a compartment round p1', function (x) { return mk.compartment(x, { name: 'inner', box: [80, 80, 140, 80] }); }, { Compartment: 1 });
var outer = step('drawn round: a compartment round all but p3', function (x) { return mk.compartment(x, { name: 'outer', box: [50, 50, 500, 420] }); }, { Compartment: 1 });
[[D.p1, inner], [D.p2, outer], [D.cx, outer]].forEach(function (q) { var w = inComp(t, q[0]); if (w[0] !== q[1].alias || w[1] !== q[1].compartment) fault('drawn round: ' + q[0] + ' in ' + w + ', not in ' + q[1].compartment); });
if (inComp(t, D.p3).join() !== ',default') fault('drawn round: p3, outside, taken in');
if (inComp(t, D.m)[0] !== null) fault('drawn round: the member given a compartment of its own');
if (!new RegExp('<compartment metaid="' + inner.compartment + '"[^>]*outside="' + outer.compartment + '"').test(t)) fault('drawn round: inner compartment not inside outer');
var p4 = step('drawn round: a species drawn inside', function (x) { return mk.species(x, { cls: 'PROTEIN', name: 'p4', box: [300, 300] }); }, { Macromolecule: 1 }).alias;
if (inComp(t, p4)[0] !== outer.alias) fault('drawn round: a species drawn inside not in it');
refused('drawn round: the outer compartment removed while it holds them', function () { mk.remove(t, [outer.alias]); }, /still holds other things/);
chain = 'other classes'; t = E0;
var OTHER = { RECEPTOR: 'PROTEIN', ION_CHANNEL: 'PROTEIN', TRUNCATED: 'PROTEIN', ION: 'SIMPLE_MOLECULE', DRUG: 'SIMPLE_MOLECULE' }, O = {};
Object.keys(OTHER).forEach(function (cls, k) {
  var o = mk.species(t, { cls: OTHER[cls], name: cls.toLowerCase(), box: [100 + 150 * k, 100] }), s0 = t.length;
  t = o.text.replace(new RegExp('(<species metaid="' + o.species + '"[\\s\\S]*?<celldesigner:class>)' + OTHER[cls]), '$1' + cls);
  if (OTHER[cls] === 'PROTEIN') t = t.replace(new RegExp('(<celldesigner:protein id="[^"]*" name="' + cls.toLowerCase() + '" type=")GENERIC'), '$1' + cls);
  O[cls] = o.alias; void s0;
});
check('other classes made', t, null, chain);
step('a residue on a receptor', function (x) { return mk.residue(x, O.RECEPTOR, { state: 'phosphorylated' }); }, {});
step('a residue on an ion channel', function (x) { return mk.residue(x, O.ION_CHANNEL, { state: 'acetylated' }); }, {});
refused('a residue on an ion', function () { mk.residue(t, O.ION, { state: 'phosphorylated' }); }, /Residues belong to proteins; this is an ion\./);
[['RECEPTOR', 'PROTEIN'], ['ION_CHANNEL', 'GENE'], ['TRUNCATED', 'RNA'], ['ION', 'SIMPLE_MOLECULE'], ['DRUG', 'UNKNOWN']].forEach(function (q) {
  step('retype ' + q[0] + ' to ' + q[1], function (x) { return mk.retype(x, O[q[0]], q[1]); }, null);
});
if (!/<celldesigner:protein id="[^"]*" name="receptor" type="GENERIC"\/>/.test(t) || /type="RECEPTOR"|type="ION_CHANNEL"|type="TRUNCATED"/.test(t)) fault('other classes retyped: the receptor not on a generic protein, or an old reference left');
if ((t.match(/<celldesigner:paint color="ffccff66" scheme="Color"\/>/g) || []).length !== 2) fault('other classes retyped: an ion or drug did not keep its colour');

// ---- 2. the demo maps ----
function unxml(s) { return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
// the original's lines a change did not keep (lines only inserted keep all), each to match `allowed`: a longest common
// subsequence of lines, between the common start and end
function kept(tag, t0, t1, allowed) {
  var a = t0.split('\n'), b = t1.split('\n'), p = 0, e = 0, lost = [];
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  while (e < a.length - p && e < b.length - p && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
  a = a.slice(p, a.length - e); b = b.slice(p, b.length - e);
  var n = a.length, m = b.length, L = new Uint16Array((n + 1) * (m + 1)), at = function (i, j) { return L[i * (m + 1) + j]; };
  for (var i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) L[i * (m + 1) + j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
  for (i = 0, j = 0; i < n;) { if (j < m && a[i] === b[j]) { i++; j++; } else if (j < m && at(i, j + 1) >= at(i + 1, j)) j++; else lost.push(a[i++]); }
  lost = lost.filter(function (l) { return !allowed || !allowed.test(l); });
  if (lost.length) fault(tag + ': ' + lost.length + ' original lines changed: ' + lost.slice(0, 2).join(' / '));
}
var maps = fs.readdirSync(path.join(here, 'maps')).filter(function (f) { return /-celldesigner\.xml$/.test(f); }).sort();
maps.forEach(function (f) {
  var t0 = fs.readFileSync(path.join(here, 'maps', f), 'utf8'), tag = f.replace('-celldesigner.xml', ''), c = 'map ' + tag, x = t0;
  var al = (t0.match(/<celldesigner:speciesAlias [^>]*>/g) || []).map(function (s) { return { id: /\sid="([^"]*)"/.exec(s)[1], cx: /complexSpeciesAlias=/.test(s), ca: (/compartmentAlias="([^"]*)"/.exec(s) || [])[1] }; })
    .filter(function (q) { return !q.cx; });
  var nameOf = function (q) { var s = /\sspecies="([^"]*)"/.exec(t0.match(new RegExp('<celldesigner:speciesAlias(?=\\s)[^>]*\\sid="' + q.id + '"[^>]*>'))[0])[1]; return /<species [^>]*\sname="([^"]*)"/.exec(t0.match(new RegExp('<species(?=\\s)[^>]*\\sid="' + s + '"[^>]*>'))[0])[1]; };
  // an existing species whose name the editor's encoding gives back as written
  var X = al.filter(function (q) { var n = nameOf(q); return t0.split('name="' + n + '"').length <= 3 && !/<celldesigner:class>DEGRADED</.test(t0.slice(t0.indexOf('name="' + n + '"'), t0.indexOf('name="' + n + '"') + 400)) && mk.cdName(cdr.plainName(unxml(n))) === unxml(n) && !/[&<>"]/.test(unxml(n)); })[0], Y = al.filter(function (q) { return q !== X; })[0];
  if (!X || !Y) { fault(tag + ': no species to work with'); return; }
  var b = /<celldesigner:bounds [^>]*>/.exec(t0.slice(t0.search(new RegExp('<celldesigner:speciesAlias(?=\\s)[^>]*\\sid="' + X.id + '"'))))[0], v = function (k) { return +new RegExp('\\s' + k + '="([^"]*)"').exec(b)[1]; };
  check(c, t0, {}, c);
  try {
    var s1 = mk.species(x, { cls: 'PROTEIN', name: 'cd_make test', box: [v('x') + 10, v('y') + 10], compartment: X.ca || null });
    kept(c + ' species', x, s1.text, /^<celldesigner:listOf\w+\/>$/); x = s1.text; check(c + ' species', x, { Macromolecule: 1 }, c);
    var r1 = mk.reaction(x, { from: s1.alias, to: X.id });
    kept(c + ' reaction', x, r1.text); x = r1.text; check(c + ' reaction', x, { Process: 1, line: 1, production: 1 }, c);
    var m1 = mk.modifier(x, r1.reaction, Y.id, 'CATALYSIS');
    kept(c + ' modifier', x, m1.text); x = m1.text; check(c + ' modifier', x, { catalysis: 1 }, c);
    var old = cdr.plainName(unxml(nameOf(X))), x1 = mk.rename(x, X.id, old + ' renamed\nand & "q" <x>');
    kept(c + ' rename', x, x1, /\sname="|<celldesigner:name>/); x = x1; check(c + ' rename', x, {}, c);
    x = mk.rename(x, X.id, old); check(c + ' named back', x, {}, c);
    x = mk.remove(x, [s1.alias]); check(c + ' removed', x, { Macromolecule: -1, Process: -1, line: -1, production: -1, catalysis: -1 }, c);
    if (x !== t0) fault(tag + ': added and removed again, not the original byte for byte');
    if (f === 'acly-celldesigner.xml' || f === 'glycolysis-celldesigner.xml') {   // a compartment drawn round an existing species
      var Z = al.filter(function (q) { return !q.ca; })[0] || al[0], zb = /<celldesigner:bounds [^>]*>/.exec(t0.slice(t0.search(new RegExp('<celldesigner:speciesAlias(?=\\s)[^>]*\\sid="' + Z.id + '"'))))[0];
      var zv = function (k) { return +new RegExp('\\s' + k + '="([^"]*)"').exec(zb)[1]; }, k1 = mk.compartment(t0, { name: 'round', box: [zv('x') - 5, zv('y') - 5, zv('w') + 10, zv('h') + 10] });
      check(c + ' a compartment drawn round a species', k1.text, { Compartment: 1 }, c);
      if (!new RegExp('<celldesigner:speciesAlias [^>]*id="' + Z.id + '"[^>]*compartmentAlias="' + k1.alias + '"').test(k1.text)) fault(c + ': a compartment drawn round a species did not take it in');
    }
    if (f === 'asthmamap-mast-cell-celldesigner.xml') {   // drawn round a complex whose members carry a compartmentAlias (as this file's do): the members get the new one too
      var tags = t0.match(/<celldesigner:(?:complexS|s)peciesAlias [^>]*>/g) || [], cxs = tags.filter(function (q2) { return /^<celldesigner:complexSpeciesAlias/.test(q2) && !/complexSpeciesAlias="/.test(q2.slice(30)); });
      var memOf = function (id) { return tags.filter(function (q2) { return q2.indexOf(' complexSpeciesAlias="' + id + '"') >= 0 && /compartmentAlias="/.test(q2); }); };
      var cx = cxs.map(function (q2) { return /\sid="([^"]*)"/.exec(q2)[1]; }).filter(function (id) { var sp = /species="([^"]*)"/.exec(tags.filter(function (q2) { return q2.indexOf(' id="' + id + '"') >= 0; })[0])[1]; return memOf(id).length && tags.filter(function (q2) { return q2.indexOf(' species="' + sp + '"') >= 0; }).length === 1; })[0];
      if (!cx) fault(c + ': no complex with members carrying a compartmentAlias');
      else {
        var cb = /<celldesigner:bounds [^>]*>/.exec(t0.slice(t0.search(new RegExp('<celldesigner:complexSpeciesAlias(?=\\s)[^>]*\\sid="' + cx + '"'))))[0], cv = function (k) { return +new RegExp('\\s' + k + '="([^"]*)"').exec(cb)[1]; };
        var k2 = mk.compartment(t0, { name: 'round', box: [cv('x') - 5, cv('y') - 5, cv('w') + 10, cv('h') + 10] });
        check(c + ' a compartment drawn round a complex', k2.text, { Compartment: 1 }, c);
        var tags2 = k2.text.match(/<celldesigner:(?:complexS|s)peciesAlias [^>]*>/g) || [], bad2 = tags2.filter(function (q2) { return q2.indexOf(' complexSpeciesAlias="' + cx + '"') >= 0 && /compartmentAlias="/.test(q2) && q2.indexOf('compartmentAlias="' + k2.alias + '"') < 0; });
        if (!tags2.some(function (q2) { return q2.indexOf(' id="' + cx + '"') >= 0 && q2.indexOf('compartmentAlias="' + k2.alias + '"') >= 0; })) fault(c + ': a compartment drawn round a complex did not take it in');
        if (bad2.length) fault(c + ': members of a complex taken in keep their old compartmentAlias: ' + bad2[0]);
      }
    }
    // existing things removed and retyped: a species, a complex, a compartment (when empty); a protein and a metabolite
    var first = function (re) { var m = re.exec(t0); return m && m[1]; }, sa = al[al.length - 1].id, csa = first(/<celldesigner:complexSpeciesAlias id="([^"]*)"/);
    check(c + ' a species removed', mk.remove(t0, [sa]), null, c);
    if (csa) check(c + ' a complex removed', mk.remove(t0, [csa]), null, c);
    var ca = first(/<celldesigner:compartmentAlias id="([^"]*)"/);
    if (ca) try { check(c + ' a compartment removed', mk.remove(t0, [ca]), null, c); } catch (e) { if (!/still holds/.test(e.message)) fault(c + ' a compartment removed: ' + e.message); }
    [['PROTEIN', 'GENE'], ['SIMPLE_MOLECULE', 'UNKNOWN']].forEach(function (q) {
      var s = first(new RegExp('<species metaid="([^"]*)"[^>]*>\\s*<annotation>\\s*<celldesigner:extension>\\s*<celldesigner:positionToCompartment>[^<]*</celldesigner:positionToCompartment>\\s*<celldesigner:speciesIdentity>\\s*<celldesigner:class>' + q[0] + '<'));
      var a = s && first(new RegExp('<celldesigner:speciesAlias id="([^"]*)" species="' + s + '"'));
      if (a) check(c + ' retype ' + q[0] + ' to ' + q[1], mk.retype(t0, a, q[1]), null, c);
    });
  } catch (e) { fault(tag + ': ' + e.stack); }
});
// gates added on three maps and removed again; the same on a map written on one line, and with CRLF line ends
function gates3(c, t0) {
  var x = t0, rid = null, ends = null, re = /<reaction [^>]*\sid="([^"]*)"[\s\S]*?<\/reaction>/g, m;
  while ((m = re.exec(t0)) && !rid) {
    var b = m[0].match(/<celldesigner:base(?:Reactant|Product) [^>]*alias="[^"]*"/g) || [];
    if (/STATE_TRANSITION</.test(m[0]) && b.length === 2) { rid = m[1]; ends = m[0]; }
  }
  var free = (t0.match(/<celldesigner:speciesAlias [^>]*>/g) || []).filter(function (s) { return !/complexSpeciesAlias=/.test(s); }).map(function (s) { return /\sid="([^"]*)"/.exec(s)[1]; })
    .filter(function (a) { return ends.indexOf('"' + a + '"') < 0 && ends.indexOf('>' + a + '<') < 0; });
  check(c, t0, {}, c);
  var g1 = mk.gate(x, { kind: 'AND', inputs: free.slice(0, 2), target: rid, output: 'CATALYSIS' });
  if (t0.split('\n').length > 200) kept(c + ' gate', x, g1.text);   // a file one element per line
  x = g1.text; check(c + ' gate on a reaction', x, { Operator: 1, line: 2, catalysis: 1 }, c);
  x = mk.gateInput(x, g1.gate, free[2]).text; check(c + ' its third input', x, { line: 1 }, c);
  var g2 = mk.gate(x, { kind: 'OR', inputs: free.slice(3, 5), target: free[5], output: 'NEGATIVE_INFLUENCE' }); x = g2.text;
  check(c + ' gate between entities', x, { Operator: 1, line: 2, inhibition: 1 }, c);
  x = mk.removeLine(x, g2.reaction); x = mk.removeLine(x, rid, g1.gate.split('|')[1]);
  check(c + ' gates removed', x, { Operator: -2, line: -5, catalysis: -1, inhibition: -1 }, c);
  if (x !== t0) fault(c + ': gates added and removed again, not the original byte for byte');
}
['inos', 'mevalonate', 'asthmamap-mast-cell'].forEach(function (f) { try { gates3('gates ' + f, fs.readFileSync(path.join(here, 'maps', f + '-celldesigner.xml'), 'utf8')); } catch (e) { fault('gates ' + f + ': ' + e.stack); } });
var acly = fs.readFileSync(path.join(here, 'maps/acly-celldesigner.xml'), 'utf8');
[['one line', acly.replace(/>\s*\n\s*</g, '><')], ['CRLF', acly.replace(/\n/g, '\r\n')]].forEach(function (v) {
  try {
    var x = v[1], c = 'acly on ' + v[0], s1 = mk.species(x, { cls: 'PROTEIN', name: 'cd_make test', box: [100, 100] });
    gates3(c + ', gates', v[1]);
    x = s1.text; check(c + ', a species', x, { Macromolecule: 1 }, c + ', gates');
    x = mk.remove(x, [s1.alias]);
    if (x !== v[1]) fault(c + ': a species added and removed, not the original byte for byte');
    if (v[0] === 'CRLF' && /[^\r]\n/.test(s1.text)) fault(c + ': a line end written without CR');
  } catch (e) { fault('acly on ' + v[0] + ': ' + e.stack); }
});

// ---- 3. gate placement against CellDesigner's ----
var placed = 0, TOL = 7.5;   // the farthest of the 16 groups lies 7.32 off the rule's place (6.33 across, 3.67 down)
if (cases && fs.existsSync(path.join(cases, 'gate-cases-placed-v01.xml'))) {
  var P = fs.readFileSync(path.join(cases, 'gate-cases-placed-v01.xml'), 'utf8'), V = fs.readFileSync(path.join(cases, 'gate-cases-v03.xml'), 'utf8');
  var re = /<reaction [^>]*\sid="([^"]*)"[\s\S]*?<\/reaction>/g, m, w = V, worst = 0;
  check('gate cases', w, {}, 'gates');
  while ((m = re.exec(P))) {
    var g = /<celldesigner:(?:modification|GateMember) type="BOOLEAN_LOGIC_GATE_(\w+)" [^>]*>/.exec(m[0]);
    if (!g) continue;
    var at = function (k) { return new RegExp('\\s' + k + '="([^"]*)"').exec(g[0])[1]; }, red = /GateMember/.test(g[0]);
    var target = red ? /<celldesigner:baseProduct [^>]*alias="([^"]*)"/.exec(m[0])[1] : m[1], ins = at('aliases').split(',');
    try {
      // two inputs, the target; a third added afterwards, which must not move the gate
      var out = mk.gate(w, { kind: g[1], inputs: ins.slice(0, 2), target: target, output: at('modificationType') }), to = out.text;
      ins.slice(2).forEach(function (a) { to = mk.gateInput(to, out.gate, a).text; });
      var want = at('editPoints').split(' ').pop().split(',').map(Number), d = Math.hypot(out.at[0] - want[0], out.at[1] - want[1]);
      var got = red ? /<celldesigner:editPoints>([^<]*)</.exec(to.slice(to.lastIndexOf('<reaction ')))[1] : /BOOLEAN_LOGIC_GATE_[^>]*editPoints="([^"]*)"/.exec(to.slice(to.search(new RegExp('<reaction(?=\\s)[^>]*\\sid="' + m[1] + '"'))))[1];
      if (got.split(',').map(Number).join() !== out.at.join()) fault('gate ' + m[1] + ': moved by its third input');
      worst = Math.max(worst, d); placed++;
      if (d > TOL) fault('gate ' + m[1] + ' (' + g[1] + '): ' + d.toFixed(1) + ' units from CellDesigner\'s place');
      if (!red && at('targetLineIndex') !== /BOOLEAN_LOGIC_GATE_[^>]*targetLineIndex="([^"]*)"/.exec(to.slice(to.search(new RegExp('<reaction(?=\\s)[^>]*\\sid="' + m[1] + '"'))))[1]) fault('gate ' + m[1] + ': on the other side of the reaction');
      var d3 = { Operator: 1, line: ins.length }; d3[(red ? RED : HEAD)[at('modificationType')]] = 1;
      w = to; check('gate cases ' + m[1], w, d3, 'gates');
    } catch (e) { fault('gate ' + m[1] + ': ' + e.message); }
  }
  console.log('gate placement: ' + placed + ' gates of CellDesigner\'s, the farthest ' + worst.toFixed(2) + ' units from its place');
} else console.log('gate placement: skipped (no gate cases folder given)');

// ---- the converter's reading of every step ----
var DRIVER = ['import sys, json, collections', 'sys.path[:0] = [' + JSON.stringify(conv) + ']', 'from mapconv import celldesigner, report', 'out = []',
  'for f in json.load(sys.stdin):', '    try:', '        with report.collect() as msgs: m = celldesigner.read(f)',
  '        c = collections.Counter(n.kind for n in m.nodes.values()); c.update(a.head or "line" for a in m.arcs)',
  '        out.append({"n": dict(c), "left": [t for k, t in msgs if k == "left out"]})', '    except Exception as e: out.append({"error": repr(e)})', 'json.dump(out, sys.stdout)'].join('\n');
var res = JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(reads.map(function (q) { return q.f; })), maxBuffer: 1 << 28 }).toString());
reads.forEach(function (q, i) {
  var o = res[i], p = i && reads[i - 1].chain === q.chain ? res[i - 1] : null;
  if (o.error) { fault(q.tag + ': the converter: ' + o.error); return; }
  var gist = function (l) { return l.replace(/\d+/g, 'N'); };   // a message new to the chain, counts aside
  if (p && !p.error) o.left.forEach(function (l) { if (p.left.map(gist).indexOf(gist(l)) < 0) fault(q.tag + ': the converter left out: ' + l); });
  if (!p || p.error || q.delta === null) return;
  var keys = new Set(Object.keys(o.n).concat(Object.keys(p.n), Object.keys(q.delta))), diff = [];
  keys.forEach(function (k) { var d = (o.n[k] || 0) - (p.n[k] || 0); if (d !== (q.delta[k] || 0)) diff.push(k + ' ' + d + ' (expected ' + (q.delta[k] || 0) + ')'); });
  if (diff.length) fault(q.tag + ': the converter reads ' + diff.join(', '));
});
fs.rmSync(tmp, { recursive: true, force: true });
console.log(reads.length + ' steps read by cdrender, cd_edit and the converter; ' + maps.length + ' demo maps: ' + (bad ? bad + ' failures' : 'all right'));
process.exit(bad ? 1 : 0);
