// renderers/converter/notation.js under Node: one case per rule of its table (allowed and refused), the accessors of the
// three formats, the palette's CellDesigner set, and the shared cases (tests/rules-cases/expected.json: GraphML maps with
// what each line should get, the converter's copy run against its own rules). No browser, no data repository.
//   node tests/notation.js
var path = require('path'), fs = require('fs'), here = path.join(__dirname, '..');
var N = require(path.join(here, 'renderers/converter/notation.js'));
var bad = 0, n = 0;
function ok(what, v, more) { n++; if (!v) bad++; if (!v) console.log('WRONG ' + what + (more ? '  ' + more : '')); }
var G = function (c, w) { return N.nodeKind('graphml', c, w); };
var M = G('Macromolecule'), S = G('SimpleChemical'), NA = G('NucleicAcidFeature'), E = G('EmptySet'), PA = G('PerturbingAgent');
var P = G('Process'), AND = G('Operator', 'AND'), NOT = G('Operator', 'NOT'), EQ = G('Operator', '≡'), DL = G('Operator', 'τ');
var PH = G('Phenotype'), SM = G('Submap'), T = G('Tag');
var PD = { sets: ['pd'] }, RD = { sets: ['pd', 'reduced'] }, AF = { sets: ['af'] };
function yes(arc, a, b, ctx, what) { var r = N.allowed(arc, a, b, ctx); ok(what + ': allowed', r === null, r); }
function no(arc, a, b, ctx, what, why) { var r = N.allowed(arc, a, b, ctx); ok(what + ': refused' + (why ? ' (' + why + ')' : ''), r !== null && (!why || r === why), r); }
function chk(name, why) { return { sets: ['pd'], check: function (c) { return c === name ? why : null; } }; }

// allow rows
yes('consumption', M, P, PD, 'consumption'); no('consumption', P, M, PD, 'consumption reversed');
yes('production', P, S, PD, 'production'); no('production', M, P, PD, 'production reversed');
['catalysis', 'modulation', 'stimulation', 'inhibition', 'necessary stimulation'].forEach(function (a) {
  yes(a, M, P, PD, a + ' to a process'); yes(a, AND, P, PD, a + ' from a gate'); yes(a, M, PH, PD, a + ' to a phenotype');
  no(a, P, M, PD, a + ' from a process');
});
yes('logic arc', M, AND, PD, 'logic arc in'); yes('logic arc', AND, NOT, PD, 'gate into gate'); no('logic arc', P, AND, PD, 'process into gate');
yes('logic arc', EQ, M, PD, 'equivalence out');
yes('equivalence arc', T, M, PD, 'tag to entity'); yes('equivalence arc', M, T, PD, 'entity to tag'); no('equivalence arc', T, P, PD, 'tag to process'); no('equivalence arc', M, S, PD, 'no tag at either end');
// reduced notation
no('stimulation', M, S, PD, 'entity to entity, reduced unticked'); yes('stimulation', M, S, RD, 'reduced: entity to entity');
no('catalysis', M, S, RD, 'reduced: no catalysis between entities');
yes('inhibition', AND, S, RD, 'reduced: gate to entity');
yes('stimulation', PH, P, RD, 'reduced: from a phenotype'); yes('stimulation', PH, P, PD, 'unticked: a phenotype modulates a process (CellDesigner)');
no('stimulation', PH, M, PD, 'unticked: nothing from a phenotype to an entity');
yes('modulation', SM, M, RD, 'reduced: from a submap'); yes('stimulation', M, SM, RD, 'reduced: into a submap');
no('stimulation', M, SM, PD, 'unticked: nothing into a submap');
// a line in reduced notation already, moved (D5): kept where Reduced notation is unticked and under Strict SBGN, a new one not
var HP = { sets: ['pd'], held: true }, HS = { sets: ['pd', 'strict'], held: true };
yes('stimulation', M, S, HP, 'held: moved onto another entity, unticked'); yes('inhibition', AND, M, HS, 'held: from a gate, Strict SBGN');
yes('modulation', PH, M, HP, 'held: from a phenotype'); no('catalysis', M, S, HP, 'held: never a catalysis between entities');
no('stimulation', M, PA, HP, 'held: not onto a perturbing agent'); no('stimulation', M, S, { sets: ['pd'], held: false }, 'not held: a new one refused');
ok('reducedType celldesigner', N.reducedType('celldesigner', 'UNKNOWN_REDUCED_MODULATION') && N.reducedType('celldesigner', 'POSITIVE_INFLUENCE') && !N.reducedType('celldesigner', 'TRANSCRIPTIONAL_ACTIVATION') && !N.reducedType('celldesigner', 'STATE_TRANSITION') && !N.reducedType('graphml', 'POSITIVE_INFLUENCE'));
ok('arcHead graphml', N.arcHead('graphml', 'inhibition') === 't_shape' && N.arcHead('graphml', 'production') === 'delta' && N.arcHead('graphml', 'logic arc') === 'none' && N.arcHead('graphml', 'x') === null && N.arcHead('sbgnml', 'production') === null);
// Strict SBGN: the specification alone
var ST = { sets: ['pd', 'strict'] }, STR = { sets: ['pd', 'reduced', 'strict', 'fanout'], check: function (c) { return c === 'gateOneOut' ? 'one out' : null; } };
yes('consumption', PH, P, PD, 'C3: a phenotype consumed (CellDesigner)'); no('consumption', PH, P, ST, 'strict: a phenotype is not consumed');
no('stimulation', PH, P, ST, 'strict: nothing leaves a phenotype'); yes('production', P, PH, PD, 'a phenotype produced (CellDesigner)'); no('production', P, PH, ST, 'strict: a phenotype is not produced');
yes('catalysis', PH, P, PD, 'a phenotype as a catalysis (CellDesigner)'); no('catalysis', PH, P, ST, 'strict: a phenotype is no catalyst');
no('stimulation', E, P, PD, 'no empty set as a modifier, unticked too', 'An empty set is only consumed or produced.'); no('stimulation', E, P, ST, 'strict: an empty set is only consumed or produced');
no('stimulation', M, S, STR, 'strict: reduced notation off'); no('stimulation', AND, P, STR, 'strict: fanout off', 'one out');
yes('stimulation', M, P, ST, 'strict: a stimulation of a process'); yes('catalysis', M, PH, ST, 'strict: catalysis onto a phenotype (3.4.1 table)');
var one = function (name, strict) { return { sets: strict ? ['pd', 'strict'] : ['pd'], check: function (c) { return c === name ? 'once' : null; } }; };
no('catalysis', M, P, one('oneCatalysis', true), 'strict: a second catalysis', 'once'); yes('catalysis', M, P, one('oneCatalysis', false), 'unticked: a second catalysis');
no('necessary stimulation', M, P, one('oneNecessary', true), 'strict: a second necessary stimulation', 'once'); yes('necessary stimulation', M, P, one('oneNecessary', false), 'unticked: a second necessary stimulation');
yes('stimulation', M, P, one('oneCatalysis', true), 'strict: stimulations not counted');
no('consumption', E, P, one('emptyOne', true), 'strict: an empty set consumed twice', 'once'); no('production', P, E, one('emptyOne', true), 'strict: an empty set produced twice', 'once');
yes('consumption', E, P, one('emptyOne', false), 'unticked: an empty set consumed twice');
// Activity Flow
var A = N.nodeKind('sbgnml', 'biological activity');
yes('stimulation', A, A, AF, 'AF: influence'); yes('inhibition', AND, A, AF, 'AF: gate output'); no('consumption', A, A, AF, 'AF: no consumption');
// refuse rows
no('stimulation', AND, P, chk('gateOneOut', 'A logic gate has one line out, and this one has it.'), 'gate one out', 'A logic gate has one line out, and this one has it.');
var fan = function (on) { return { sets: on ? ['pd', 'fanout'] : ['pd'], check: function (c) { return c === 'gateOneOut' ? 'one out' : null; } }; };
yes('stimulation', AND, P, fan(true), 'proposed fanout: an AND gate\u2019s second line out'); yes('stimulation', G('Operator', 'OR'), P, fan(true), 'proposed fanout: an OR gate\u2019s second line out');
no('stimulation', AND, P, fan(false), 'fanout off: one line out', 'one out'); no('logic arc', NOT, AND, fan(true), 'fanout on: a NOT gate keeps one line out', 'one out');
no('logic arc', EQ, M, fan(true), 'fanout on: an equivalence keeps one line out', 'one out');
no('logic arc', M, NOT, chk('oneInput', 'one'), 'NOT one input', 'one'); no('logic arc', M, DL, chk('oneInput', 'one'), 'delay one input', 'one');
yes('logic arc', M, AND, chk('oneInput', 'one'), 'AND takes many');
no('consumption', M, P, chk('already', 'There.'), 'already', 'There.');
no('consumption', M, P, chk('reversible', 'R.'), 'reversible', 'R.');
yes('consumption', M, P, { sets: ['af'], check: function (c) { return c === 'reversible' ? 'R.' : null; } }, 'the reversible check is asked in PD only');
no('production', E, P, PD, 'empty set produces nothing', 'An empty set is only consumed or produced.'); no('logic arc', E, AND, PD, 'no logic arc from an empty set');
yes('consumption', E, P, PD, 'empty set consumed'); yes('production', P, E, PD, 'empty set produced');
no('catalysis', M, E, PD, 'nothing modulates an empty set'); no('equivalence arc', T, E, PD, 'no tag for an empty set', 'An empty set is only consumed or produced.');
no('consumption', PA, P, PD, 'agent consumed', 'A perturbing agent only starts a modulation, stimulation, inhibition or necessary stimulation.');
yes('stimulation', PA, P, PD, 'agent stimulates'); no('production', P, PA, PD, 'agent produced');
yes('catalysis', NA, P, PD, 'a nucleic acid feature as a catalysis (CellDesigner)'); no('catalysis', NA, P, ST, 'strict: nucleic acid feature', 'A nucleic acid feature is no catalyst.'); yes('stimulation', NA, P, PD, 'nucleic acid feature stimulates');
yes('catalysis', PH, P, RD, 'reduced: catalysis from a phenotype into a process'); no('catalysis', PH, M, RD, 'reduced: no catalysis from a phenotype to an entity');
no('catalysis', M, SM, RD, 'catalysis into a submap', 'A catalysis goes from an entity to a process.');
no('logic arc', EQ, AND, PD, 'equivalence into a gate', 'An equivalence joins entities only.');
no('logic arc', AND, EQ, PD, 'gate into equivalence', 'An equivalence joins entities only.');
no('stimulation', EQ, P, PD, 'equivalence line', 'An equivalence’s line goes to an entity.');
no('tag', M, P, PD, 'not an arc');
// accessors
ok('graphml gate word', G('Operator', 'or').cls === 'or' && G('Operator', 'x') === null);
ok('graphml unknown', G('StateVariable') === null);
ok('sbgnml multimer', N.nodeKind('sbgnml', 'macromolecule multimer').cls === 'macromolecule');
ok('sbgnml perturbation', N.nodeKind('sbgnml', 'perturbation').cls === 'perturbing agent');
ok('celldesigner classes', N.nodeKind('celldesigner', 'RNA').cls === 'nucleic acid feature' && N.nodeKind('celldesigner', 'BOOLEAN_LOGIC_GATE_AND').kind === 'gate');
ok('arcs graphml', N.arcKind('graphml', 'none', 'process') === 'consumption' && N.arcKind('graphml', 'none', 'gate') === 'logic arc' && N.arcKind('graphml', 'white_delta_bar') === 'necessary stimulation');
ok('arcs sbgnml', N.arcKind('sbgnml', 'negative influence') === 'inhibition' && N.arcKind('sbgnml', 'catalysis') === 'catalysis');
ok('arcs celldesigner', N.arcKind('celldesigner', 'REDUCED_TRIGGER') === 'necessary stimulation' && N.arcKind('celldesigner', 'UNKNOWN_CATALYSIS') === 'catalysis');
ok('mapKind celldesigner', N.mapKind('celldesigner', '<celldesigner:speciesAlias id="a"/><reaction><celldesigner:reactionType>STATE_TRANSITION</celldesigner:reactionType></reaction> type="NEGATIVE_INFLUENCE"') === 'hybrid');
ok('mapKind graphml unknown', N.mapKind('graphml', '<graphml/>') === null);
var se = require(path.join(here, 'renderers/converter/sbgn_edit.js'));
ok('mapKind sbgnml from sbgn_edit', N.mapKind('sbgnml', '<sbgn><map language="activity flow"><glyph class="biological activity" id="a"/></map></sbgn>', { sbgn_edit: se }) === 'af');
// the palette's CellDesigner set
var off = N.paletteOff(['cd']);
ok('palette cd set', Object.keys(off).sort().join() === 'delay,tag' && !Object.keys(N.paletteOff([])).length);
// the shared cases
var cases = path.join(here, 'tests/rules-cases');
if (fs.existsSync(path.join(cases, 'expected.json'))) n += require('./rules-cases/run.js')(N, cases, function (what, v, more) { if (!v) { bad++; console.log('WRONG ' + what + (more ? '  ' + more : '')); } });
console.log((bad ? bad + ' of ' + n + ' WRONG' : 'All ' + n + ' cases ok') + ' (notation.js, ' + (N.RULES.allow.length + N.RULES.refuse.length) + ' rules)');
process.exit(bad ? 1 : 0);
