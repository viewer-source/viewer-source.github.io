// cd_make: makes and changes things in a CellDesigner 4.x file (SBML L2V4 with CellDesigner's extension), the
// editor's writer for new species, reactions and gates; JavaScript only. Every function takes the CellDesigner text and
// splices into it only what changes (cd_edit's Text), so the rest stays byte for byte and the file opens in CellDesigner
// 4.4 as it was left; something added and removed again gives the text back as it was, lists written in the file's own
// form. Each element is written as CellDesigner 4.4 saves it (its saves of the gate cases and the converter's test files)
// and as the converter's celldesigner.py write() writes it (checked against CellDesigner 4.4.2): one element per line,
// no indentation, the same order and defaults; inserted lines take the file's line ends. Ids as CellDesigner makes them
// (s, sa, csa, c, ca, re, pr, gn, rn, rs), the number after the highest one in the text. Everything refused throws an
// Error whose message is the reason, for the editor's status line.
//   empty(opt) -> text                                     opt: { id, W, H }
//   species(t, { cls, name, box, compartment, complex }) -> { text, alias, species }   (compartment left out: the one round its box)
//   compartment(t, { name, box, oval }) -> { text, alias, compartment }   oval: CellDesigner's OVAL class, else SQUARE
//   rename(t, alias, name), retype(t, alias, cls), remove(t, [alias, ...]) -> text
//   reaction(t, { type, from, to }), reduced(t, { type, from, to }) -> { text, reaction }
//   reactant(t, rid, alias), product(t, rid, alias), modifier(t, rid, alias, type) -> { text, part }   (part: r<n>, p<n>, m<n>)
//   reactionType(t, rid, type), reversible(t, rid, on), modifierType(t, rid, n, type), removeLine(t, rid, part?) -> text
//   gate(t, { kind, inputs, target, output }) -> { text, reaction, gate, at }   (gate: '<rid>|m<n>' on a reaction, '<rid>' between entities)
//   gateInput(t, gate, alias) -> { text, part } (part null between entities); gateInputRemove(t, gate, alias), gateType(t, gate, { kind, output }) -> text
//   residue(t, alias, { name, state }) -> { text, residue }; residueState(t, alias, n, state), residueRemove(t, alias, n) -> text
//   structural(t, alias, text|null, replace), info(t, alias, text|null, replace), homodimer(t, alias, n) -> text
//   joinable(t, alias, cx) -> '' or why not; join(t, alias, cx), leave(t, alias, ca|null) -> text   (complex membership)
//   about(t, rid) -> { type, mods, modAliases, gate, inputs, gates, rl, pl }; aliasInfo(t, alias) -> { kind, cls, id, name, complex, box }   (for the editor's menus)
//   (in Node the XML parser is @xmldom/xmldom, in the browser its own; cdrender.js and cd_edit.js load first)
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var cdr = node ? require('./cdrender.js') : root.cdrender, ed = node ? require('./cd_edit.js') : root.cd_edit;
  var DP = root.DOMParser || (node ? require('@xmldom/xmldom').DOMParser : null);
  var py = cdr.py, repr = py.repr, F = py.F, X = cdr.xml, q = ed.reEscape;
  var CD = 'celldesigner:';
  // CellDesigner 4.4's new species: box width, height and fill (its saves and maps made in it); the palette. A simple
  // molecule 40 by 40, a circle as the palette's sign and SBGN's simple chemical (CellDesigner's own is 70 by 25); a gene,
  // an RNA and a phenotype 80 by 40, a protein's size (CellDesigner's own is 80 by 30)
  var LOOK = { PROTEIN: [80, 40, 'ffccffcc'], GENE: [80, 40, 'ffffff66'], RNA: [80, 40, 'ff66ff66'], SIMPLE_MOLECULE: [40, 40, 'ffccff66'],
    UNKNOWN: [70, 25, 'ffcccccc'], PHENOTYPE: [80, 40, 'ffcc99ff'], DEGRADED: [30, 30, 'ffffcccc'], COMPLEX: [100, 120, 'fff7f7f7'] };
  // a new compartment: its size, CellDesigner's yellow, its two lines (outer, inner) and the band between them
  var COMP = { size: [160, 160], colour: 'ffcccc00', thickness: 12, outer: 2, inner: 1 };
  // classes with a reference: its element, the species' element naming it, its list, id prefix, type. The protein kinds
  // (receptor, ion channel, truncated) share proteins, told apart by type, and carry residues
  var PROT = ['protein', 'proteinReference', 'listOfProteins', 'pr'];
  var REF = { PROTEIN: PROT.concat('GENERIC'), RECEPTOR: PROT.concat('RECEPTOR'), ION_CHANNEL: PROT.concat('ION_CHANNEL'), TRUNCATED: PROT.concat('TRUNCATED'),
    GENE: ['gene', 'geneReference', 'listOfGenes', 'gn', 'GENE'], RNA: ['RNA', 'rnaReference', 'listOfRNAs', 'rn', 'RNA'],
    ANTISENSE_RNA: ['AntisenseRNA', 'antisensernaReference', 'listOfAntisenseRNAs', 'arn', 'ANTISENSE_RNA'] };
  var PROCESS = ['STATE_TRANSITION', 'KNOWN_TRANSITION_OMITTED', 'UNKNOWN_TRANSITION'];
  var FULL = PROCESS.concat(['TRANSPORT', 'TRANSCRIPTION', 'TRANSLATION']);   // reactions drawn with a process square (cd_edit's FULL)
  // the reactions that may be reversible: every one with a process (cdrender's list of the non-reduced types), never
  // reduced notation, a modulation or a gate's
  var TWO_WAY = FULL.concat(['HETERODIMER_ASSOCIATION', 'DISSOCIATION', 'TRUNCATION']);
  // reduced notation as SBGN's influences: POSITIVE_INFLUENCE (CellDesigner's open arrowhead, not an SBGN sign) is neither
  // offered nor kept; sbgn() makes it REDUCED_PHYSICAL_STIMULATION (the open triangle) when a file is opened for editing,
  // and its dashed UNKNOWN_POSITIVE_INFLUENCE UNKNOWN_REDUCED_PHYSICAL_STIMULATION
  var REDUCED = ['NEGATIVE_INFLUENCE', 'REDUCED_PHYSICAL_STIMULATION', 'REDUCED_MODULATION', 'REDUCED_TRIGGER'];
  var MODS = ['CATALYSIS', 'INHIBITION', 'PHYSICAL_STIMULATION', 'MODULATION', 'TRIGGER'];
  // inputs a gate needs: AND and OR two, NOT one, the unknown gate one (it has no rule of its own); a gate
  // left with fewer, by a removal, goes as a whole
  var NEED = { AND: 2, OR: 2, NOT: 1, UNKNOWN: 1 };
  // CellDesigner's fixed residue states (the converter's STATE, cdrender's SYMBOL)
  var STATES = ['phosphorylated', 'acetylated', 'ubiquitinated', 'methylated', 'hydroxylated', 'glycosylated', 'myristoylated', 'palmytoylated',
    'prenylated', 'sulfated', 'protonated', "don't care", 'unknown', 'empty'];
  var ALIASES = { speciesAlias: 'listOfSpeciesAliases', complexSpeciesAlias: 'listOfComplexSpeciesAliases', compartmentAlias: 'listOfCompartmentAliases' };
  // lists CellDesigner always writes, empty or not
  var KEEP = /^celldesigner:listOf(CompartmentAliases|ComplexSpeciesAliases|SpeciesAliases|Proteins|Genes|RNAs|AntisenseRNAs)$/;
  var DOWN = '-1.5707963267948966', LINE = '<celldesigner:line width="1.0" color="ff000000"/>';
  // a name as the converter writes it (cd_name, cdrender's NAME), a line break as CellDesigner's _br_
  function unesc(s) { return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }   // an attribute's text as the XML parser reads it
  function cdName(s) { s = String(s).replace(/\r?\n/g, '_br_'); cdr.NAME.forEach(function (n) { s = s.split(n[0]).join(n[1]); }); return s; }
  function esc(s) { return py.escape(s).replace(/"/g, '&quot;'); }
  function fail(s) { throw new Error(s); }
  function an(w) { return (/^(RNA|[aeiou])/i.test(w) ? 'an ' : 'a ') + w; }
  function kind(cls) { return /RNA/.test(cls) ? cls.replace('ANTISENSE_', 'antisense ') : cls.toLowerCase().replace(/_/g, ' '); }

  // ---- the text (cd_edit's Text): spans [start, end) of elements found by the pattern of their start tag ----
  function span(t, open, a, b) { return new ed.Text(t).span(open, a || 0, b); }
  function attrs(t, i, values) { var T = new ed.Text(t); T.attrs(i, values); return T.done(); }   // [[name, value or null], ...]
  function all(t, open, sp) { var out = [], i = sp[0], s; while ((s = span(t, open, i, sp[1]))) { out.push({ sp: s, tag: head(t, s) }); i = s[1]; } return out; }
  function head(t, sp) { return t.slice(sp[0], t.indexOf('>', sp[0]) + 1); }
  function at(tag, k) { var m = new RegExp('\\s' + q(k) + '="([^"]*)"').exec(tag); return m ? m[1] : null; }
  function put(t, a, b, s) { return t.slice(0, a) + (t.indexOf('\r\n') >= 0 ? s.replace(/\r?\n/g, '\r\n') : s) + t.slice(b); }   // the file's line ends
  function eol(t, i) { return t.startsWith('\r\n', i) ? i + 2 : t[i] === '\n' ? i + 1 : i; }   // past the line end at i, if any
  function cut(t, sp) { return put(t, sp[0], eol(t, sp[1]), ''); }
  function after(t, s, a) { var i = t.indexOf(s, a || 0); return i < 0 ? -1 : eol(t, i + s.length); }
  function before(t, marks) { for (var k = 0; k < marks.length; k++) { var i = t.indexOf(marks[k]); if (i >= 0) return i; } return -1; }
  function opens(t, tag) { return new RegExp('<' + q(tag) + '>\\s+</' + q(tag) + '>').test(t); }   // the file writes that list open when empty
  // an item added last to the list <tag> found in [a, b): a list written empty (<tag/>) opened, a missing one made at
  // `make` (after the element before it). In a file writing that list open when empty, a list made here starts with
  // its item on its own line, so emptied it is told from the file's own (drop())
  function list(t, tag, item) { return '<' + tag + '>' + (opens(t, tag) ? '' : '\n') + item + '\n</' + tag + '>'; }
  function add(t, tag, item, a, b, make) {
    var l = span(t, '<' + tag + '[\\s>/]', a, b);
    if (!l) return put(t, make, make, list(t, tag, item) + '\n');
    if (t[l[1] - 2] === '/') return put(t, l[0], l[1], list(t, tag, item));
    var c = l[1] - tag.length - 3;
    return put(t, c, c, item + '\n');
  }
  // an element cut out; then each enclosing element of `up` (innermost first) left empty goes too, unless the file writes
  // that list open when empty and it is not one made here (add()): then it stays; a list CellDesigner always writes (KEEP)
  // is written empty in the form the file writes empty lists (open, else <x/>). So an item added and removed again leaves
  // the text as it was
  function drop(t, sp, up) {
    t = cut(t, sp);
    for (var i = 0; i < (up || []).length; i++) {
      var tag = up[i], o = t.lastIndexOf('<' + tag + '>', sp[0]);
      if (o < 0) return t;
      var l = span(t, '<' + tag + '>', o);
      var body = t.slice(o + tag.length + 2, l[1] - tag.length - 3), rest = t.slice(0, l[0]) + t.slice(l[1]);
      if (body.trim() || body && opens(rest, tag)) return t;
      if (KEEP.test(tag)) { var m = /<(celldesigner:listOf\w+)>(\s*)<\/\1>/.exec(rest); return put(t, l[0], l[1], m ? '<' + tag + '>' + m[2] + '</' + tag + '>' : '<' + tag + '/>'); }
      t = cut(t, l); sp = l;
    }
    return t;
  }
  function next(t, p) {   // the id after the highest p<n> in the text
    var re = new RegExp('[\\s"\'>,]' + p + '(\\d+)(?=[\\s"\'<,])', 'g'), m, n = 0;
    while ((m = re.exec(t))) n = Math.max(n, +m[1]);
    return p + (n + 1);
  }
  function metas(t) { var re = /CDMT(\d+)/g, m, n = 0; while ((m = re.exec(t))) n = Math.max(n, +m[1]); return function () { return 'CDMT' + String(++n).padStart(5, '0'); }; }
  function num(v) { return repr(F(v)); }
  function ids(t, open) { var re = new RegExp(open, 'g'), m, out = []; while ((m = re.exec(t))) out.push(at(head(t, [m.index]), 'id')); return out; }   // of the elements found
  function inside(t, attr, v) { return ids(t, '<celldesigner:(?:speciesAlias|complexSpeciesAlias)(?=\\s)[^>]*\\s' + attr + '="' + q(v) + '"'); }   // aliases by attribute

  // ---- what the text holds ----
  function alias(t, id) {
    var sp = span(t, '<celldesigner:(?:speciesAlias|complexSpeciesAlias|compartmentAlias)(?=\\s)[^>]*\\sid="' + q(id) + '"');
    if (!sp) fail('No ' + id + ' on the map.');
    var tag = head(t, sp), b = /<celldesigner:bounds [^>]*>/.exec(t.slice(sp[0], sp[1]));
    var A = { id: id, sp: sp, kind: /^<celldesigner:(\w+)/.exec(tag)[1], species: at(tag, 'species'), complex: at(tag, 'complexSpeciesAlias'),
      ca: at(tag, 'compartmentAlias'), compartment: at(tag, 'compartment'), box: b ? ['x', 'y', 'w', 'h'].map(function (k) { return F(at(b[0], k)); }) : null };
    if (A.species) { A.s = species(t, A.species); A.cls = A.s.cls; }
    return A;
  }
  function entity(t, id) { var A = alias(t, id); if (!A.species) fail('A compartment has no lines, residues or units.'); return A; }
  // a line's end: never a complex's member, until a CellDesigner save shows how it holds one
  function end(t, id) { var A = entity(t, id); if (A.complex) fail('A line joins the complex, not one of its members.'); return A; }
  function species(t, sid) {
    var sp = span(t, '<species(?=\\s)[^>]*\\sid="' + q(sid) + '"') || span(t, '<celldesigner:species(?=\\s)[^>]*\\sid="' + q(sid) + '"');
    if (!sp) fail('No species ' + sid + ' on the map.');
    var seg = t.slice(sp[0], sp[1]), r = /<celldesigner:(?:protein|gene|rna|antisenserna)Reference>([^<]*)</.exec(seg), c = /<celldesigner:class>([^<]*)</.exec(seg);
    return { id: sid, sp: sp, inc: t[sp[0] + 1] === 'c', name: at(head(t, sp), 'name'), cls: c ? c[1] : null, ref: r ? r[1] : null };
  }
  function aliasesOf(t, sid) { return inside(t, 'species', sid); }
  function reference(t, ref) { return span(t, '<celldesigner:(?:protein|gene|RNA|AntisenseRNA)(?=\\s)[^>]*\\sid="' + q(ref) + '"'); }
  function users(t, ref) {   // the species naming a reference
    var re = new RegExp('Reference>' + q(ref) + '<', 'g'), m, out = [];
    while ((m = re.exec(t))) { var o = Math.max(t.lastIndexOf('<species ', m.index), t.lastIndexOf('<celldesigner:species ', m.index)); out.push(at(head(t, [o]), 'id')); }
    return out;
  }
  function centre(A) { return [A.box[0] + A.box[2] / 2, A.box[1] + A.box[3] / 2]; }
  function rspan(t, rid) { var s = span(t, '<reaction(?=\\s)[^>]*\\sid="' + q(rid) + '"'); if (!s) fail('No reaction ' + rid + ' on the map.'); return s; }
  function isReaction(t, id) { return !!span(t, '<reaction(?=\\s)[^>]*\\sid="' + q(id) + '"'); }
  function isGate(m) { return /^BOOLEAN_LOGIC_GATE_/.test(at(m.tag, 'type')); }
  function parts(t, rid) {   // a reaction's participants as its text has them, each { sp, tag }
    var rs = rspan(t, rid), x = span(t, '<celldesigner:extension>', rs[0], rs[1]);
    return { id: rid, rs: rs, x: x, type: /<celldesigner:reactionType>([^<]*)</.exec(t.slice(rs[0], rs[1]))[1],
      br: all(t, '<celldesigner:baseReactant[\\s>/]', x), bp: all(t, '<celldesigner:baseProduct[\\s>/]', x),
      rl: all(t, '<celldesigner:reactantLink ', x), pl: all(t, '<celldesigner:productLink ', x),
      mods: all(t, '<celldesigner:modification ', x), gm: all(t, '<celldesigner:GateMember ', x) };
  }
  function process(t, rid) { var R = parts(t, rid); if (FULL.indexOf(R.type) < 0) fail('Only a reaction with a process square takes this; ' + rid + ' is ' + R.type + '.'); return R; }
  // the reaction's square and the direction of its main line, as cd_edit's lines() places them, read from a map of the
  // reaction and its two ends alone (its modifiers left out: they do not move the square); null on a branched reaction
  function square(t, rid) {
    var R = parts(t, rid);
    if (R.br.length !== 1 || R.bp.length !== 1) return null;
    var lm = span(t, '<celldesigner:listOfModification>', R.x[0], R.x[1]), rx = t.slice(R.rs[0], lm ? lm[0] : R.rs[1]) + (lm ? t.slice(lm[1], R.rs[1]) : '');
    var lists = { speciesAlias: '', complexSpeciesAlias: '' }, sp = { s: '', c: '' };
    [R.br[0], R.bp[0]].forEach(function (p) {
      var A = alias(t, at(p.tag, 'alias'));
      lists[A.kind] += t.slice(A.sp[0], A.sp[1]); sp[A.s.inc ? 'c' : 's'] += t.slice(A.s.sp[0], A.s.sp[1]);
    });
    var mini = /<sbml\b[^>]*>/.exec(t)[0] + '<model><annotation><celldesigner:extension><celldesigner:modelDisplay sizeX="1" sizeY="1"/><celldesigner:listOfIncludedSpecies>' + sp.c +
      '</celldesigner:listOfIncludedSpecies><celldesigner:listOfComplexSpeciesAliases>' + lists.complexSpeciesAlias + '</celldesigner:listOfComplexSpeciesAliases><celldesigner:listOfSpeciesAliases>' +
      lists.speciesAlias + '</celldesigner:listOfSpeciesAliases></celldesigner:extension></annotation><listOfSpecies>' + sp.s + '</listOfSpecies><listOfReactions>' + rx + '</listOfReactions></model></sbml>';
    var d = ed.drawing(mini, { DOMParser: DP }), r = ed.lines(d, X.findall(d.model, 's:listOfReactions/s:reaction')[0]);
    return r && r.glyph ? r : null;
  }
  // the square's side a point lies on: targetLineIndex 2 on the left of the main line's direction (above a line drawn
  // left to right), 3 on the right (CellDesigner's saves: 3 where the gate is below or left of the line)
  function side(P, r) { return r && (P[0] - r.sq[0]) * r.fl[1] - (P[1] - r.sq[1]) * r.fl[0] < 0 ? 3 : 2; }

  // ---- elements as CellDesigner writes them ----
  function scheme(rect) {
    return '<celldesigner:connectScheme connectPolicy="direct"' + (rect ? ' rectangleIndex="0"' : '') + '>\n<celldesigner:listOfLineDirection>\n' +
      '<celldesigner:lineDirection index="0" value="unknown"/>\n</celldesigner:listOfLineDirection>\n</celldesigner:connectScheme>';
  }
  function inactive(A) { return '<celldesigner:linkTarget species="' + A.species + '" alias="' + A.id + '">\n<celldesigner:linkAnchor position="INACTIVE"/>\n</celldesigner:linkTarget>'; }
  function sref(tag, meta, A) {
    return '<' + tag + ' metaid="' + meta + '" species="' + A.species + '">\n<annotation>\n<celldesigner:extension>\n<celldesigner:alias>' + A.id +
      '</celldesigner:alias>\n</celldesigner:extension>\n</annotation>\n</' + tag + '>';
  }
  function identity(cls, ref, name) {
    var r = REF[cls];
    return '<celldesigner:speciesIdentity>\n<celldesigner:class>' + cls + '</celldesigner:class>\n' +
      (r ? '<celldesigner:' + r[1] + '>' + ref + '</celldesigner:' + r[1] + '>' : '<celldesigner:name>' + name + '</celldesigner:name>') + '\n</celldesigner:speciesIdentity>';
  }
  function aliasXml(id, sid, cls, b, extra, ip, colour) {
    var cx = cls === 'COMPLEX', tag = cx ? 'complexSpeciesAlias' : 'speciesAlias', col = colour || LOOK[cls][2], w = cx ? '2.0' : '1.0';
    return '<celldesigner:' + tag + ' id="' + id + '" species="' + sid + '"' + extra + '>\n<celldesigner:activity>inactive</celldesigner:activity>\n' +
      '<celldesigner:bounds x="' + num(b[0]) + '" y="' + num(b[1]) + '" w="' + num(b[2]) + '" h="' + num(b[3]) + '"/>\n<celldesigner:font size="12"/>\n' +
      '<celldesigner:view state="usual"/>\n' + (cx ? '<celldesigner:backupSize w="0.0" h="0.0"/>\n<celldesigner:backupView state="none"/>\n' : '') +
      '<celldesigner:usualView>\n<celldesigner:innerPosition x="' + num(ip[0]) + '" y="' + num(ip[1]) + '"/>\n<celldesigner:boxSize width="' + num(b[2]) +
      '" height="' + num(b[3]) + '"/>\n<celldesigner:singleLine width="' + w + '"/>\n<celldesigner:paint color="' + col + '" scheme="Color"/>\n</celldesigner:usualView>\n' +
      '<celldesigner:briefView>\n<celldesigner:innerPosition x="0.0" y="0.0"/>\n<celldesigner:boxSize width="80.0" height="60.0"/>\n<celldesigner:singleLine width="' + w +
      '"/>\n<celldesigner:paint color="' + (cx ? col : '3fff0000') + '" scheme="Color"/>\n</celldesigner:briefView>\n' +
      '<celldesigner:info state="empty" angle="' + DOWN + '"/>\n</celldesigner:' + tag + '>';
  }
  function grow(t, b) {   // the map's size taken past a box beyond it, as cd_edit's place() does (and CellDesigner)
    var md = span(t, '<celldesigner:modelDisplay '), tag = head(t, md), W = F(at(tag, 'sizeX')), H = F(at(tag, 'sizeY')), v = [];
    if (b[0] + b[2] > W) v.push(['sizeX', String(Math.ceil(b[0] + b[2] + 40))]);
    if (b[1] + b[3] > H) v.push(['sizeY', String(Math.ceil(b[1] + b[3] + 40))]);
    return v.length ? attrs(t, md[0], v) : t;
  }
  var EXT = '</celldesigner:extension>';   // the first one in a file ends the model's extension, where its lists are

  // ---- the map ----
  function empty(opt) {
    opt = opt || {};
    var id = opt.id || 'untitled', s = '', units = [['substance', 'mole'], ['volume', 'litre'], ['area', 'metre', '2'], ['length', 'metre'], ['time', 'second']];
    units.forEach(function (u, k) {
      s += '<unitDefinition metaid="' + u[0] + '" id="' + u[0] + '" name="' + u[0] + '">\n<listOfUnits>\n<unit metaid="CDMT0000' + (k + 1) + '" kind="' + u[1] + '"' +
        (u[2] ? ' exponent="' + u[2] + '"' : '') + '/>\n</listOfUnits>\n</unitDefinition>\n';
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n<sbml xmlns="http://www.sbml.org/sbml/level2/version4" xmlns:celldesigner="http://www.sbml.org/2001/ns/celldesigner" level="2" version="4">\n' +
      '<model metaid="' + id + '" id="' + id + '">\n<annotation>\n<celldesigner:extension>\n<celldesigner:modelVersion>4.0</celldesigner:modelVersion>\n' +
      '<celldesigner:modelDisplay sizeX="' + (opt.W || 600) + '" sizeY="' + (opt.H || 400) + '"/>\n' +
      ['CompartmentAliases', 'ComplexSpeciesAliases', 'SpeciesAliases', 'Groups', 'Proteins', 'Genes', 'RNAs', 'AntisenseRNAs', 'Layers', 'BlockDiagrams']
        .map(function (k) { return '<celldesigner:listOf' + k + '/>\n'; }).join('') +
      '</celldesigner:extension>\n</annotation>\n<listOfUnitDefinitions>\n' + s + '</listOfUnitDefinitions>\n<listOfCompartments>\n' +
      '<compartment metaid="default" id="default" size="1" units="volume"/>\n</listOfCompartments>\n</model>\n</sbml>\n';
  }
  function compartments(t) { return all(t, '<celldesigner:compartmentAlias ', [0, t.length]).map(function (c) { return alias(t, at(c.tag, 'id')); }); }
  function compartment(t, o) {
    var b = (o.box || [0, 0].concat(COMP.size)).map(F), cid = next(t, 'c'), aid = next(t, 'ca'), name = esc(cdName(o.name || cid));
    if (!(b[2] > 0 && b[3] > 0)) fail('A compartment needs a width and a height.');
    var out = holder(t, b), pc = out ? out.compartment : 'default', moved = [];
    // the name at the top middle (cdrender.nameLeft; 12.5 below the top, as the converter writes it), on an oval too;
    // CellDesigner's yellow
    var nx = cdr.nameLeft(b, cdName(o.name || cid));
    t = add(t, CD + 'listOfCompartmentAliases', '<celldesigner:compartmentAlias id="' + aid + '" compartment="' + cid + '">\n<celldesigner:class>' + (o.oval ? 'OVAL' : 'SQUARE') + '</celldesigner:class>\n' +
      '<celldesigner:bounds x="' + num(b[0]) + '" y="' + num(b[1]) + '" w="' + num(b[2]) + '" h="' + num(b[3]) + '"/>\n<celldesigner:namePoint x="' + num(nx) +
      '" y="' + num(b[1] + 12.5) + '"/>\n<celldesigner:doubleLine thickness="' + num(COMP.thickness) + '" outerWidth="' + num(COMP.outer) + '" innerWidth="' + num(COMP.inner) + '"/>\n<celldesigner:paint color="' + COMP.colour + '" scheme="Color"/>\n' +
      '<celldesigner:info state="empty" angle="' + DOWN + '"/>\n</celldesigner:compartmentAlias>', 0, t.length, t.indexOf(EXT));
    t = add(t, 'listOfCompartments', '<compartment metaid="' + cid + '" id="' + cid + '" name="' + name + '" size="1" units="volume" outside="' + (out ? out.compartment : 'default') +
      '">\n<annotation>\n<celldesigner:extension>\n<celldesigner:name>' + name + '</celldesigner:name>\n</celldesigner:extension>\n</annotation>\n</compartment>', 0, t.length);
    // what it is drawn round moves into it (membership follows the boxes, as the editor's GraphML nests
    // them): every compartment and every species, complexes with their members, held so far by the compartment that now
    // holds the new one and lying wholly inside it. A species belongs to one compartment, so one with an alias left outside
    // (or in another compartment) stays as it is, all its aliases with it
    var C = alias(t, aid), mine = function (A) { return A.id !== aid && A.box && ed.inside(A.box, b) && where(t, A) === pc; };
    compartments(t).filter(mine).forEach(function (K) { t = attrs(t, span(t, '<compartment(?=\\s)[^>]*\\sid="' + q(K.compartment) + '"')[0], [['outside', cid]]); });
    ids(t, '<celldesigner:(?:speciesAlias|complexSpeciesAlias)(?=\\s)(?![^>]*\\scomplexSpeciesAlias=)').map(function (a) { return alias(t, a); }).forEach(function (A) {
      if (moved.indexOf(A.species) >= 0) return;
      var all_ = aliasesOf(t, A.species).map(function (a) { return alias(t, a); });
      if (!all_.every(mine)) return;
      moved.push(A.species);
      all_.forEach(function (B) {
        var ip = span(t, '<celldesigner:innerPosition ', span(t, '<celldesigner:usualView>', B.sp[0])[0]), was = B.ca ? alias(t, B.ca).box : null;
        // its offset from the compartment's top left, where the file wrote it so (as cd_edit's place() keeps it)
        if (ip && was && Math.abs(F(at(head(t, ip), 'x')) - (B.box[0] - was[0])) < 1e-3 && Math.abs(F(at(head(t, ip), 'y')) - (B.box[1] - was[1])) < 1e-3 ||
            ip && !was && F(at(head(t, ip), 'x')) === 0 && F(at(head(t, ip), 'y')) === 0) t = attrs(t, ip[0], [['x', num(B.box[0] - C.box[0])], ['y', num(B.box[1] - C.box[1])]]);
        t = attrs(t, alias(t, B.id).sp[0], [['compartmentAlias', aid]]);
        t = memberCa(t, B.id, aid);
      });
      var S = species(t, A.species);
      if (!S.inc) t = attrs(t, S.sp[0], [['compartment', cid]]);
    });
    return { text: grow(t, b), alias: aid, compartment: cid };
  }
  // a complex's members that carry a compartmentAlias (CellDesigner writes their complex's), nested ones too: the new one
  function memberCa(t, cx, ca) {   // (cd_edit.carriers, shared with place())
    ed.carriers(t, cx).forEach(function (q) { if (q[1] !== ca) t = attrs(t, alias(t, q[0]).sp[0], [['compartmentAlias', ca]]); });
    return t;
  }
  // the innermost compartment wholly holding a box (cd_edit's tree()), null when none
  function holder(t, b) { return compartments(t).filter(function (C) { return C.box && ed.inside(b, C.box); }).sort(function (p, r) { return p.box[2] * p.box[3] - r.box[2] * r.box[3]; })[0] || null; }
  // the compartment an alias is in: its compartmentAlias's, else its species' (a compartment's: its outside), 'default' when none
  function where(t, A) {
    if (A.kind === 'compartmentAlias') return at(head(t, span(t, '<compartment(?=\\s)[^>]*\\sid="' + q(A.compartment) + '"')), 'outside') || 'default';
    return A.ca ? alias(t, A.ca).compartment : at(head(t, A.s.sp), 'compartment') || 'default';
  }
  // a reference for a class with one, by name and type (the converter: one per name), null when there is none
  function referenceOf(t, cls, name) {
    var r = REF[cls], l = span(t, '<' + CD + r[2] + '[\\s>/]');
    var hit = l && all(t, '<celldesigner:' + r[0] + '(?=\\s)[^>]*\\sname="' + q(name) + '"', l).filter(function (e) { return (at(e.tag, 'type') || r[4]) === r[4]; })[0];
    return hit ? at(hit.tag, 'id') : null;
  }
  function referenceFor(t, cls, name) {   // that reference, else a new one
    var id = referenceOf(t, cls, name), r = REF[cls];
    if (id) return [t, id];
    id = next(t, r[3]);
    return [add(t, CD + r[2], '<celldesigner:' + r[0] + ' id="' + id + '" name="' + name + '" type="' + r[4] + '"/>', 0, t.length, t.indexOf(EXT)), id];
  }
  function unused(t, ref) {   // a reference no species names any more goes
    var sp = reference(t, ref);
    if (!sp || t.indexOf('Reference>' + ref + '<') >= 0) return t;
    var tag = /^<celldesigner:(\w+)/.exec(head(t, sp))[1];
    return drop(t, sp, [CD + REF[Object.keys(REF).filter(function (k) { return REF[k][0] === tag; })[0]][2]]);
  }
  function newSpecies(t, o) {
    var cls = o.cls;
    if (!LOOK[cls]) fail('The CellDesigner class ' + cls + ' is not offered.');
    if (o.colour != null && !/^[0-9a-f]{8}$/i.test(o.colour)) fail('A species\u2019 colour is eight hex digits (alpha, red, green, blue).');
    var L = LOOK[cls], b0 = o.box || [0, 0], b = [F(b0[0]), F(b0[1]), F(b0[2] != null ? b0[2] : L[0]), F(b0[3] != null ? b0[3] : L[1])];
    var sid = next(t, 's'), aid = next(t, cls === 'COMPLEX' ? 'csa' : 'sa'), extra = '', ip = [0, 0], comp = 'default', C = null, ref = null;
    // a new species is named after its id until named (CellDesigner's way), a degraded one always
    var name = esc(cdName(cls !== 'DEGRADED' && o.name ? o.name : sid));
    if (o.complex) {   // a member: its offset in the complex, no compartment (CellDesigner's files)
      C = alias(t, o.complex);
      if (C.kind !== 'complexSpeciesAlias') fail('That is not a complex.');
      extra = ' complexSpeciesAlias="' + C.id + '"'; ip = [b[0] - C.box[0], b[1] - C.box[1]];
    } else if (o.compartment || holder(t, b)) {   // in a compartment, given or else the innermost holding its box: its offset
      // from the compartment's top left (CellDesigner's save of estrogen)
      var K = o.compartment ? alias(t, o.compartment) : holder(t, b);
      if (K.kind !== 'compartmentAlias') fail('That is not a compartment.');
      extra = ' compartmentAlias="' + K.id + '"'; ip = [b[0] - K.box[0], b[1] - K.box[1]]; comp = K.compartment;
    }
    if (REF[cls]) { var rr = referenceFor(t, cls, name); t = rr[0]; ref = rr[1]; }
    t = add(t, CD + ALIASES[cls === 'COMPLEX' ? 'complexSpeciesAlias' : 'speciesAlias'], aliasXml(aid, sid, cls, b, extra, ip, o.colour && o.colour.toLowerCase()), 0, t.length, t.indexOf(EXT));
    if (C) {   // an included species, not in listOfSpecies
      t = add(t, CD + 'listOfIncludedSpecies', '<celldesigner:species id="' + sid + '" name="' + name + '">\n<celldesigner:notes>\n<html xmlns="http://www.w3.org/1999/xhtml">\n' +
        '<head>\n<title/>\n</head>\n<body/>\n</html>\n</celldesigner:notes>\n<celldesigner:annotation>\n<celldesigner:complexSpecies>' + C.species +
        '</celldesigner:complexSpecies>\n' + identity(cls, ref, name) + '\n</celldesigner:annotation>\n</celldesigner:species>', 0, t.indexOf(EXT),
        after(t, '>', t.indexOf('<celldesigner:modelDisplay ')));   // after the map's size, as CellDesigner writes it
    } else {
      t = add(t, 'listOfSpecies', '<species metaid="' + sid + '" id="' + sid + '" name="' + name + '" compartment="' + comp + '" initialAmount="0">\n<annotation>\n' +
        '<celldesigner:extension>\n<celldesigner:positionToCompartment>inside</celldesigner:positionToCompartment>\n' + identity(cls, ref, name) +
        '\n</celldesigner:extension>\n</annotation>\n</species>', 0, t.length, after(t, '</listOfCompartments>'));
    }
    return { text: grow(t, b), alias: aid, species: sid };
  }
  function noResidues(t, sid) { var l = inState(t, sid, '<celldesigner:listOfModifications>'); return l ? drop(t, l, [CD + 'state']) : t; }   // its residues' states

  // a name written where CellDesigner keeps it: a compartment's name and its extension's copy; a species' name and its
  // identity's (classes without a reference). A protein, gene or RNA, with every species of its reference that had the
  // old name (CellDesigner keeps a species' name as its reference's): onto the reference of the new name when there is
  // one (one reference per name, as the converter; their residue states go, the residues being the old protein's), else
  // its reference renamed when no other species names it, else a new reference; the old one dropped when unused
  function rename(t, id, name) {
    var A = alias(t, id), nm = esc(cdName(name)), set = function (open) {   // the name attribute and a <celldesigner:name> inside
      t = attrs(t, span(t, open)[0], [['name', nm]]);
      var sp = span(t, open), s = span(t, '<celldesigner:name>', sp[0], sp[1]);
      if (s) t = put(t, s[0], s[1], '<celldesigner:name>' + nm + '</celldesigner:name>');
    };
    if (A.kind === 'compartmentAlias') {   // a name at the top middle kept there (cdrender.nameLeft), one placed elsewhere left
      var C0 = span(t, '<compartment(?=\\s)[^>]*\\sid="' + q(A.compartment) + '"'), was = unesc(at(head(t, C0), 'name') || A.compartment);
      var np = span(t, '<celldesigner:namePoint ', A.sp[0], A.sp[1]), nx0 = np && F(at(head(t, np), 'x'));
      set('<compartment(?=\\s)[^>]*\\sid="' + q(A.compartment) + '"');
      if (np && A.box && Math.abs(nx0 - cdr.nameLeft(A.box, was)) < 1) t = attrs(t, span(t, '<celldesigner:namePoint ', alias(t, id).sp[0], alias(t, id).sp[1])[0], [['x', num(cdr.nameLeft(A.box, cdName(name)))]]);
      return t;
    }
    if (A.cls === 'DEGRADED') fail('A degraded species keeps its id as its name.');
    var S = A.s, old = S.name;
    if (!S.ref) { set((S.inc ? '<celldesigner:species' : '<species') + '(?=\\s)[^>]*\\sid="' + q(S.id) + '"'); return t; }
    var named = users(t, S.ref), group = named.filter(function (s) { return s === S.id || species(t, s).name === old; });
    var to = referenceOf(t, A.cls, nm);
    if (to === S.ref) to = null;
    if (!to && group.length === named.length) t = attrs(t, reference(t, S.ref)[0], [['name', nm]]);
    else if (!to) { var rr = referenceFor(t, A.cls, nm); t = rr[0]; to = rr[1]; }
    group.forEach(function (sid) {
      t = attrs(t, species(t, sid).sp[0], [['name', nm]]);
      if (!to) return;
      var P = species(t, sid), tag = REF[P.cls][1], s = span(t, '<celldesigner:' + tag + '>', P.sp[0], P.sp[1]);
      t = noResidues(put(t, s[0], s[1], '<celldesigner:' + tag + '>' + to + '</celldesigner:' + tag + '>'), sid);
    });
    return unused(t, S.ref);
  }
  // a class changed into one of the palette's: the identity's reference (the one of the new class's name and type) or
  // name; residue states dropped when the protein changes (the residues are the protein's); the old reference dropped when
  // unused; a multimer made degraded a single one first; the fill moved to the new class's when it was the old one's default (a class outside the palette keeps its
  // colour), or cols.from, the old class's colour for new species in the editor's choice, then to cols.to; never to or
  // from a complex
  function retype(t, id, cls, cols) {
    var A = entity(t, id), was = A.cls;
    if (!LOOK[cls]) fail('The CellDesigner class ' + cls + ' is not offered.');
    if (cls === 'COMPLEX' || was === 'COMPLEX') fail('A complex and a single species cannot be changed into one another: delete it and draw anew.');
    if (cls === was) return t;
    var hd = cls === 'DEGRADED' && inState(t, A.species, '<celldesigner:homodimer>');   // a degraded species is no multimer: the count to 1 first, its box with it, a count of 1 dropped
    if (hd) { t = +/>(\d+)</.exec(t.slice(hd[0], hd[1]))[1] > 1 ? homodimer(t, id, 1) : drop(t, hd, [CD + 'state']); A = entity(t, id); }
    var S = A.s, name = S.name, ref = null;
    if (REF[cls]) { var rr = referenceFor(t, cls, name); t = rr[0]; ref = rr[1]; }
    if (S.ref && ref !== S.ref) t = noResidues(t, S.id);
    S = species(t, S.id);
    var si = span(t, '<celldesigner:speciesIdentity>', S.sp[0], S.sp[1]), seg = t.slice(si[0], si[1]);
    var keep = /<celldesigner:hypothetical>[^<]*<\/celldesigner:hypothetical>\s*/.exec(seg), st = span(seg, '<celldesigner:state>');
    var state = st ? seg.slice(st[0], st[1]) + '\n' : '', id2 = identity(cls, ref, name).split('\n'), mid = id2[2] + '\n';
    // the state after a reference, before a name (the converter's identity())
    t = put(t, si[0], si[1], id2[0] + '\n' + id2[1] + '\n' + (keep ? keep[0] : '') + (REF[cls] ? mid + state : state + mid) + id2[3]);
    if (S.ref) t = unused(t, S.ref);
    aliasesOf(t, S.id).forEach(function (a) {
      var B = alias(t, a), u = span(t, '<celldesigner:usualView>', B.sp[0], B.sp[1]), p = u && span(t, '<celldesigner:paint ', u[0], u[1]);
      var now = p && at(head(t, p), 'color');
      if (now && (LOOK[was] && now === LOOK[was][2] || cols && cols.from && now === cols.from)) t = attrs(t, p[0], [['color', cols && cols.to || LOOK[cls][2]]]);
    });
    return t;
  }

  // ---- reactions ----
  // a line's end at a species: one of CellDesigner's 16 places (cdrender ANCHOR), or none, the centre
  var PLACES = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function anchorXml(at) {
    if (at && PLACES.indexOf(at) < 0) fail('No place ' + at + ' on a species.');
    return at ? '<celldesigner:linkAnchor position="' + at + '"/>\n' : '';
  }
  function newReaction(t, type, ins, out, scheme_, body, outAt) {
    var rid = next(t, 're'), meta = metas(t), ref = function (A) { return sref('speciesReference', meta(), A); };
    var x = '<reaction metaid="' + rid + '" id="' + rid + '" reversible="false">\n<annotation>\n<celldesigner:extension>\n<celldesigner:reactionType>' + type +
      '</celldesigner:reactionType>\n<celldesigner:baseReactants>\n' + ins.map(function (A) { return '<celldesigner:baseReactant species="' + A.species + '" alias="' + A.id + '"/>\n'; }).join('') +
      '</celldesigner:baseReactants>\n<celldesigner:baseProducts>\n<celldesigner:baseProduct species="' + out.species + '" alias="' + out.id + '"' +
      (outAt ? '>\n' + anchorXml(outAt) + '</celldesigner:baseProduct>' : '/>') + '\n</celldesigner:baseProducts>\n' +
      scheme_ + '\n' + LINE + '\n' + (body ? body + '\n' : '') + '</celldesigner:extension>\n</annotation>\n<listOfReactants>\n' + ins.map(ref).join('\n') +
      '\n</listOfReactants>\n<listOfProducts>\n' + ref(out) + '\n</listOfProducts>\n</reaction>';
    // a new listOfReactions in SBML L2V4's order of a model's lists: before listOfEvents, the last
    return { text: add(t, 'listOfReactions', x, 0, t.length, before(t, ['<listOfEvents', '</model>'])), reaction: rid };
  }
  function ends(t, o) {
    var A = end(t, o.from), B = end(t, o.to);
    if (A.id === B.id) fail('A line needs two different entities.');
    return [A, B];
  }
  // a reaction: the base reactant to the base product, the square midway on its one segment (rectangleIndex 0)
  function reaction(t, o) {
    var type = o.type || 'STATE_TRANSITION', e = ends(t, o);
    if (PROCESS.indexOf(type) < 0) fail('The reaction type ' + type + ' is not offered.');
    return newReaction(t, type, [e[0]], e[1], scheme(true), null, o.toAt);
  }
  // reduced notation: a reaction with no square, its start at the centre (no linkAnchor, as the converter writes it), its
  // end at the place given (o.toAt) or the centre
  function reduced(t, o) {
    var e = ends(t, o);
    if (REDUCED.indexOf(o.type) < 0) fail('The reduced notation type ' + o.type + ' is not offered.');
    return newReaction(t, o.type, [e[0]], e[1], scheme(false), null, o.toAt);
  }
  function joined(R) { return R.br.concat(R.bp, R.rl, R.pl).map(function (p) { return at(p.tag, 'alias'); }); }
  // an added reactant or product: its link to the square's segment (no linkAnchor: to the centre) and its SBML reference
  function link(t, rid, id, into, at) {   // at: the place at the species (none: the centre)
    var R = process(t, rid), A = end(t, id), list = into ? 'listOfReactantLinks' : 'listOfProductLinks', n = (into ? R.rl : R.pl).length;
    if (joined(R).indexOf(id) >= 0) fail('This entity is already a reactant or product of the reaction.');
    var el = '<celldesigner:' + (into ? 'reactantLink reactant' : 'productLink product') + '="' + A.species + '" alias="' + id + '" targetLineIndex="-1,' + (into ? 0 : 1) +
      '">\n' + anchorXml(at) + scheme(false) + '\n<celldesigner:line width="1.0" color="ff000000" type="Straight"/>\n</celldesigner:' + (into ? 'reactantLink' : 'productLink') + '>';
    var rl = span(t, '<celldesigner:listOfReactantLinks>', R.x[0], R.x[1]);
    t = add(t, CD + list, el, R.x[0], R.x[1], into || !rl ? after(t, '</celldesigner:baseProducts>', R.x[0]) : after(t, '</celldesigner:listOfReactantLinks>', R.x[0]));
    var rs = rspan(t, rid);
    t = add(t, into ? 'listOfReactants' : 'listOfProducts', sref('speciesReference', metas(t)(), A), rs[0], rs[1]);
    return { text: t, part: (into ? 'r' : 'p') + n };
  }
  function reactant(t, rid, id, at) { return link(t, rid, id, true, at); }
  function product(t, rid, id, at) { return link(t, rid, id, false, at); }
  // modifications appended to a reaction's listOfModification, each species' SBML reference, and the reaction in each
  // species' listOfCatalyzedReactions (CellDesigner lists every modifier there, not only catalysts)
  function addMods(t, rid, els, ins) {
    var R = parts(t, rid);
    t = add(t, CD + 'listOfModification', els.join('\n'), R.x[0], R.x[1], R.x[1] - EXT.length);
    var rs = rspan(t, rid), meta = metas(t);
    t = add(t, 'listOfModifiers', ins.map(function (A) { return sref('modifierSpeciesReference', meta(), A); }).join('\n'), rs[0], rs[1], after(t, '</listOfProducts>', rs[0]));
    ins.forEach(function (A) { t = catalyze(t, A.species, rid); });
    return t;
  }
  function catalyze(t, sid, rid) {
    var S = species(t, sid), item = '<celldesigner:catalyzed reaction="' + rid + '"/>';
    if (S.inc || t.slice(S.sp[0], S.sp[1]).indexOf(item) >= 0) return t;   // an included species has no such list
    return add(t, CD + 'listOfCatalyzedReactions', item, S.sp[0], S.sp[1], after(t, '</celldesigner:speciesIdentity>', S.sp[0]));
  }
  function uncatalyze(t, sid, rid) {
    var S = species(t, sid), item = '<celldesigner:catalyzed reaction="' + rid + '"/>', i = t.indexOf(item, S.sp[0]);
    return i >= 0 && i < S.sp[1] ? drop(t, [i, i + item.length], [CD + 'listOfCatalyzedReactions']) : t;
  }
  function modifier(t, rid, id, type, spot) {   // spot: its place at the square, 2 to 7 (cdrender SQUARE; none: the side facing it)
    var R = process(t, rid), A = end(t, id);
    if (MODS.indexOf(type) < 0) fail('The modifier type ' + type + ' is not offered.');
    if (spot != null && !(spot >= 2 && spot <= 7)) fail('No place ' + spot + ' at a reaction\u2019s square.');
    twin(R, id, type, []);
    var el = '<celldesigner:modification type="' + type + '" modifiers="' + A.species + '" aliases="' + id + '" targetLineIndex="-1,' + (spot != null ? spot : side(centre(A), square(t, rid))) +
      '">\n' + scheme(false) + '\n' + LINE + '\n</celldesigner:modification>';
    return { text: addMods(t, rid, [el], [A]), part: 'm' + R.mods.length };
  }
  function sbgn(t) {   // -> { text, n }: every (UNKNOWN_)POSITIVE_INFLUENCE (a reaction's type, a gate's output, its inputs' lines) the open triangle
    var n = 0;
    // only where CellDesigner writes a type (reactionType, a line's type, a gate's modificationType), never a name or a note
    var to = function (m, a, u) { n++; return a + (u || '') + 'REDUCED_PHYSICAL_STIMULATION'; };
    t = t.replace(/(<celldesigner:reactionType>\s*)(UNKNOWN_)?POSITIVE_INFLUENCE(?=\s*<)/g, to).replace(/(\s(?:type|modificationType)=["'])(UNKNOWN_)?POSITIVE_INFLUENCE(?=["'])/g, to);
    return { text: t, n: n };
  }
  function reactionType(t, rid, type) {
    var R = parts(t, rid), fam = function (x) { return FULL.indexOf(x) >= 0 ? 1 : /INFLUENCE|REDUCED/.test(x) ? 2 : 0; };
    if ((PROCESS.indexOf(type) < 0 && REDUCED.indexOf(type) < 0) || !fam(R.type) || fam(type) !== fam(R.type))
      fail('A ' + R.type + ' cannot become ' + type + ': reactions change among reactions, reduced notation among its own kinds.');
    var s = span(t, '<celldesigner:reactionType>', R.x[0]);
    return put(t, s[0], s[1], '<celldesigner:reactionType>' + type + '</celldesigner:reactionType>');
  }
  // a reaction made reversible or not: CellDesigner's reversible attribute, left out when reversible (SBML's default, as
  // CellDesigner and the converter write it), "false" when not; cdrender then draws a head at its reactants too. Only a
  // reaction of TWO_WAY (reduced notation is a modulation, never reversible)
  function reversible(t, rid, on) {
    var R = parts(t, rid);
    if (TWO_WAY.indexOf(R.type) < 0) fail('A ' + R.type + ' is not reversible: only a reaction with a process is.');
    return attrs(t, R.rs[0], [['reversible', on ? null : 'false']]);
  }
  function modifierType(t, rid, n, type) {
    var R = parts(t, rid), m = R.mods[n];
    if (!m) fail('No modifier ' + n + ' on ' + rid + '.');
    if (isGate(m)) return gateType(t, rid + '|m' + n, { output: type });
    var g = owner(R, n);
    if (g !== null) return gateType(t, rid + '|m' + g, { output: type });
    if (MODS.indexOf(type) < 0) fail('The modifier type ' + type + ' is not offered.');
    twin(R, at(m.tag, 'aliases'), type, [n]);
    return attrs(t, m.sp[0], [['type', type]]);
  }
  function owner(R, n) {   // the gate whose input's own modification n is: same alias, the gate's output type
    var m = R.mods[n], hit = null;
    R.mods.forEach(function (g, k) { if (hit === null && isGate(g) && at(g.tag, 'aliases').split(',').indexOf(at(m.tag, 'aliases')) >= 0 && at(g.tag, 'modificationType') === at(m.tag, 'type')) hit = k; });
    return hit;
  }
  // an input's own line of gate g in a list (modifications, or gate members between entities): same alias, the gate's
  // output type (cdrender's reading), the first after the gate (CellDesigner writes them there), else any
  function own(list, g, a) {
    var hits = [];
    list.forEach(function (m, k) { if (!isGate(m) && at(m.tag, 'aliases') === a && at(m.tag, 'type') === at(g.tag, 'modificationType')) hits.push(k); });
    var i = list.findIndex(function (m) { return m.sp[0] === g.sp[0]; }), k = hits.filter(function (h) { return h > i; }).concat(hits)[0];
    return k === undefined ? -1 : k;
  }
  // a line CellDesigner could not tell from another: the same entity twice a modifier, or a modifier and a gate's input,
  // of one type (the modifications in `skip` left out: the lines being changed)
  function twin(R, id, type, skip) {
    if (R.mods.some(function (m, k) { return skip.indexOf(k) < 0 && (!isGate(m) && at(m.tag, 'aliases') === id && at(m.tag, 'type') === type || isGate(m) && at(m.tag, 'aliases').split(',').indexOf(id) >= 0 && at(m.tag, 'modificationType') === type); }))
      fail('This entity already has ' + an(type.toLowerCase().replace(/_/g, ' ')) + ' line to the reaction; a second one could not be told apart.');
  }
  // a reaction's k-th SBML reference to alias a (the k-th line of that alias; else its last), else the first of its
  // species naming no alias
  function unref(t, rid, list, tag, a, sid, k) {
    var rs = rspan(t, rid), ls = span(t, '<' + list + '>', rs[0], rs[1]), refs = ls ? all(t, '<' + tag + ' ', ls) : [];
    var hits = refs.filter(function (r) { var al = /<celldesigner:alias>([^<]*)</.exec(t.slice(r.sp[0], r.sp[1])); return al && al[1] === a; });
    var hit = hits[Math.min(k || 0, hits.length - 1)] || refs.filter(function (r) { return at(r.tag, 'species') === sid && t.slice(r.sp[0], r.sp[1]).indexOf('<celldesigner:alias>') < 0; })[0];
    return hit ? drop(t, hit.sp, [list]) : t;
  }
  // modifications n... of a reaction cut out, from the last; each plain one with its SBML reference, and the reaction
  // off a species' listOfCatalyzedReactions once none of its modifications on it stays
  function dropMods(t, rid, ns) {
    var sids = [];
    ns.slice().sort(function (a, b) { return b - a; }).forEach(function (n) {
      var mods = parts(t, rid).mods, m = mods[n], a = at(m.tag, 'aliases');
      var k = mods.slice(0, n).filter(function (o) { return !isGate(o) && at(o.tag, 'aliases') === a; }).length;
      t = drop(t, m.sp, [CD + 'listOfModification']);
      if (!isGate(m)) { t = unref(t, rid, 'listOfModifiers', 'modifierSpeciesReference', a, at(m.tag, 'modifiers'), k); sids.push(at(m.tag, 'modifiers')); }
    });
    var left = parts(t, rid).mods.filter(function (m) { return !isGate(m); }).map(function (m) { return at(m.tag, 'modifiers'); });
    sids.forEach(function (s) { if (left.indexOf(s) < 0) t = uncatalyze(t, s, rid); });
    return t;
  }
  function dropReaction(t, rid) {
    t = drop(t, rspan(t, rid), ['listOfReactions']);
    var item = '<celldesigner:catalyzed reaction="' + rid + '"/>', i;
    while ((i = t.indexOf(item)) >= 0) t = drop(t, [i, i + item.length], [CD + 'listOfCatalyzedReactions']);
    return t;
  }
  // one line removed: a modifier (m<n>; a gate's own goes with its inputs' lines, an input's line takes the input off its
  // gate), an added reactant (r<n>) or product (p<n>); with no part, the whole reaction
  function removeLine(t, rid, part) {
    if (!part) return dropReaction(t, rid);
    var m = /^([mrp])(\d+)$/.exec(part), R = parts(t, rid), n = m ? +m[2] : -1;
    if (m && m[1] === 'm' && R.mods[n]) {
      if (isGate(R.mods[n])) return dropGate(t, gateAt(t, rid + '|m' + n));
      var g = owner(R, n);
      return g === null ? dropMods(t, rid, [n]) : gateInputRemove(t, rid + '|m' + g, at(R.mods[n].tag, 'aliases'));
    }
    var into = m && m[1] === 'r', el = m && (into ? R.rl : R.pl)[n];
    if (!el) fail('No line ' + part + ' on ' + rid + '.');
    t = drop(t, el.sp, [CD + (into ? 'listOfReactantLinks' : 'listOfProductLinks')]);
    return unref(t, rid, into ? 'listOfReactants' : 'listOfProducts', 'speciesReference', at(el.tag, 'alias'), at(el.tag, into ? 'reactant' : 'product'));
  }

  // ---- logic gates (as CellDesigner 4.4 saves them) ----
  // placed at the mean of the first two inputs' box centres and the target (the reaction's square, or the target
  // entity's centre in reduced notation); NOT, with one input, at the mean of it and the target. Every gate CellDesigner
  // placed in 16 test cases lies within 7.4 units of it (6.4 along either axis); inputs added afterwards never move it.
  function gate(t, o) {
    var k = o.kind, ins = (o.inputs || []).map(function (a) { return end(t, a); }), out = o.output;
    if (!NEED[k]) fail('The gate ' + k + ' is not offered.');
    if (o.spot != null && !(o.spot >= 2 && o.spot <= 7)) fail('No place ' + o.spot + ' at a reaction\u2019s square.');   // o.spot: its line's place at the square (none: the side facing it); o.toAt: at a species (none: the centre)
    if (ins.length < NEED[k]) fail(an(k).replace(/^a/, 'A') + ' gate needs ' + (NEED[k] === 2 ? 'two inputs.' : 'an input.'));
    if (new Set(o.inputs).size !== ins.length || o.inputs.indexOf(o.target) >= 0) fail('A gate\'s inputs and its target are different entities.');
    var mean = function (ps) { return [ps.reduce(function (s, p) { return s + p[0]; }, 0) / ps.length, ps.reduce(function (s, p) { return s + p[1]; }, 0) / ps.length]; };
    var C = ins.slice(0, 2).map(centre), type = 'BOOLEAN_LOGIC_GATE_' + k, al = o.inputs.join(','), G, pt;
    if (isReaction(t, o.target)) {   // on a reaction: a BOOLEAN_LOGIC_GATE_* modification listing the inputs, then each input's own
      var R = process(t, o.target), r = square(t, o.target);
      out = out || 'CATALYSIS';   // CellDesigner's default output
      if (!r) fail('A gate joins a reaction with one reactant and one product.');
      if (MODS.indexOf(out) < 0) fail('A gate\'s output ' + out + ' is not a modifier type.');
      ins.forEach(function (A) { twin(R, A.id, out, []); });
      G = mean(C.concat([r.sq])); pt = num(G[0]) + ',' + num(G[1]);
      var g = '<celldesigner:modification type="' + type + '" modifiers="' + ins.map(function (A) { return A.species; }).join(',') + '" aliases="' + al +
        '" modificationType="' + out + '" targetLineIndex="-1,' + (o.spot != null ? o.spot : side(G, r)) + '" editPoints="' + pt + '">\n' + scheme(false) + '\n' + LINE + '\n</celldesigner:modification>';
      t = addMods(t, o.target, [g].concat(ins.map(function (A) { return ownLine('modification', out, A); })), ins);
      return { text: t, reaction: o.target, gate: o.target + '|m' + R.mods.length, at: G };
    }
    // between entities: a BOOLEAN_LOGIC_GATE reaction, the inputs its base reactants, the target its base product
    var T = end(t, o.target);
    out = out || 'REDUCED_TRIGGER';   // as in CellDesigner's save of the gate cases
    if (REDUCED.indexOf(out) < 0) fail('A gate\'s output ' + out + ' is not a reduced notation type.');
    G = mean(C.concat([centre(T)])); pt = num(G[0]) + ',' + num(G[1]);
    var r2 = newReaction(t, 'BOOLEAN_LOGIC_GATE', ins, T, '<celldesigner:connectScheme connectPolicy="direct"/>\n<celldesigner:editPoints>' + pt + '</celldesigner:editPoints>',
      '<celldesigner:listOfGateMember>\n<celldesigner:GateMember type="' + type + '" aliases="' + al + '" modificationType="' + out + '" targetLineIndex="-1,-1" editPoints="' + pt +
      '">\n' + scheme(false) + '\n' + LINE + '\n</celldesigner:GateMember>\n' + ins.map(function (A) { return ownLine('GateMember', out, A); }).join('\n') + '\n</celldesigner:listOfGateMember>', o.toAt);
    return { text: r2.text, reaction: r2.reaction, gate: r2.reaction, at: G };
  }
  function ownLine(tag, out, A) {   // an input's own line to its gate: the output's type, from the input's centre (INACTIVE)
    return '<celldesigner:' + tag + ' type="' + out + '"' + (tag === 'modification' ? ' modifiers="' + A.species + '"' : '') + ' aliases="' + A.id + '">\n' +
      scheme(false) + '\n' + inactive(A) + '\n' + LINE + '\n</celldesigner:' + tag + '>';
  }
  function gateAt(t, ref) {
    var m = /^(.*)\|m(\d+)$/.exec(ref), rid = m ? m[1] : ref, R = parts(t, rid), el = m ? R.mods[+m[2]] : R.gm.filter(isGate)[0];
    if (!el || !isGate(el)) fail('No logic gate at ' + ref + '.');
    var type = at(el.tag, 'type');
    return { rid: rid, R: R, el: el, n: m ? +m[2] : -1, kind: type.slice(19), inputs: at(el.tag, 'aliases').split(','), out: at(el.tag, 'modificationType') };
  }
  function gateInput(t, ref, id) {
    var g = gateAt(t, ref), A = end(t, id);
    if (g.inputs.indexOf(id) >= 0 || joined(g.R).indexOf(id) >= 0 && g.n < 0) fail('This entity is already joined to the gate.');
    if (g.kind === 'NOT') fail('A NOT gate has one input, and this one has it.');
    if (g.n >= 0) twin(g.R, id, g.out, []);
    var el = ownLine(g.n < 0 ? 'GateMember' : 'modification', g.out, A);
    t = attrs(t, g.el.sp[0], [g.n < 0 ? null : ['modifiers', at(g.el.tag, 'modifiers') + ',' + A.species], ['aliases', g.inputs.concat([id]).join(',')]].filter(Boolean));
    if (g.n >= 0) return { text: addMods(t, g.rid, [el], [A]), part: 'm' + g.R.mods.length };
    var R = parts(t, g.rid);
    t = add(t, CD + 'listOfGateMember', el, R.x[0], R.x[1]);
    t = add(t, CD + 'baseReactants', '<celldesigner:baseReactant species="' + A.species + '" alias="' + id + '"/>', R.x[0], R.x[1]);
    var rs = rspan(t, g.rid);
    return { text: add(t, 'listOfReactants', sref('speciesReference', metas(t)(), A), rs[0], rs[1]), part: null };
  }
  function dropGate(t, g) {
    return g.n < 0 ? dropReaction(t, g.rid) : dropMods(t, g.rid, [g.n].concat(g.inputs.map(function (a) { return own(g.R.mods, g.el, a); }).filter(function (k) { return k >= 0; })));
  }
  // an input taken off its gate: its line (own modification or gate member), its base reactant between entities, its
  // SBML reference; the gate goes whole when left with fewer inputs than it needs (NEED)
  function gateInputRemove(t, ref, id) {
    var g = gateAt(t, ref), i = g.inputs.indexOf(id);
    if (i < 0) fail('That entity is not an input of the gate.');
    if (g.inputs.length - 1 < NEED[g.kind]) return dropGate(t, g);
    var keep = g.inputs.filter(function (a) { return a !== id; });
    if (g.n >= 0) {
      var k = own(g.R.mods, g.el, id), sids = at(g.el.tag, 'modifiers').split(',');
      sids.splice(i, 1);
      t = attrs(t, g.el.sp[0], [['modifiers', sids.join(',')], ['aliases', keep.join(',')]]);
      return k >= 0 ? dropMods(t, g.rid, [k]) : t;
    }
    var k2 = own(g.R.gm, g.el, id), br = g.R.br.filter(function (p) { return at(p.tag, 'alias') === id; })[0];
    if (k2 < 0 || !br) fail('The gate\'s line from that input is missing from the file; it is left as it is.');
    t = attrs(t, g.el.sp[0], [['aliases', keep.join(',')]]);
    t = drop(t, parts(t, g.rid).gm[k2].sp);
    t = drop(t, parts(t, g.rid).br.filter(function (p) { return at(p.tag, 'alias') === id; })[0].sp);
    return unref(t, g.rid, 'listOfReactants', 'speciesReference', id, at(br.tag, 'species'));
  }
  // a gate's kind (AND, OR, NOT, UNKNOWN) or output changed; its inputs' own lines take the output's type
  function gateType(t, ref, o) {
    var g = gateAt(t, ref);
    if (o.kind) {
      if (!NEED[o.kind]) fail('The gate ' + o.kind + ' is not offered.');
      if (g.inputs.length < NEED[o.kind]) fail(an(o.kind).replace(/^a/, 'A') + ' gate needs two inputs.');
      if (o.kind === 'NOT' && g.inputs.length > 1) fail('A NOT gate has one input; this gate has ' + g.inputs.length + '.');
      t = attrs(t, g.el.sp[0], [['type', 'BOOLEAN_LOGIC_GATE_' + o.kind]]);
    }
    if (o.output && o.output !== g.out) {
      if ((g.n < 0 ? REDUCED : MODS).indexOf(o.output) < 0) fail('A gate\'s output ' + o.output + ' is not offered here.');
      if (g.n >= 0) g.inputs.forEach(function (a) { twin(g.R, a, o.output, [g.n, own(g.R.mods, g.el, a)]); });
      g.inputs.forEach(function (a) {   // the inputs' own lines first, found by the old output
        var h = gateAt(t, ref), list = h.n < 0 ? h.R.gm : h.R.mods, k = own(list, h.el, a);
        if (k >= 0) t = attrs(t, list[k].sp[0], [['type', o.output]]);
      });
      t = attrs(t, gateAt(t, ref).el.sp[0], [['modificationType', o.output]]);
    }
    return t;
  }

  // ---- removing ----
  // aliases removed with all that hangs on them: a complex's members; every reaction whose base reactant or product goes
  // (between entities a gate's target), whole; a gate input taken off its gate (the gate whole when left too few); a
  // modifier, added reactant or product cut from its reaction; listOfCatalyzedReactions kept to the modifiers left; a
  // species with no alias left, a reference no species names, a compartment with no alias. A compartment goes only empty.
  function remove(t, aliases) {
    var S = new Set(), take = function (a) {
      if (S.has(a)) return;
      var A = alias(t, a); S.add(a);
      if (A.kind === 'complexSpeciesAlias') inside(t, 'complexSpeciesAlias', a).forEach(take);
    };
    aliases.forEach(take);
    var gone = new Set(), list = Array.from(S).map(function (a) { return alias(t, a); });
    list.forEach(function (A) { if (A.species && aliasesOf(t, A.species).every(function (a) { return S.has(a); })) gone.add(A.species); });
    // a compartment goes only empty: no alias left in its box; when its last alias goes, no species left in it and no
    // compartment left inside it
    list.forEach(function (A) {
      if (A.kind !== 'compartmentAlias') return;
      var c = A.compartment, cs = compartments(t), last = cs.every(function (C) { return C.compartment !== c || S.has(C.id); });
      var within = ids(t, '<compartment(?=\\s)[^>]*\\soutside="' + q(c) + '"');
      if (inside(t, 'compartmentAlias', A.id).some(function (a) { return !S.has(a); }) || last && (ids(t, '<species(?=\\s)[^>]*\\scompartment="' + q(c) + '"').some(function (s) { return !gone.has(s); }) ||
          cs.some(function (C) { return within.indexOf(C.compartment) >= 0 && !S.has(C.id); }))) fail('The compartment still holds other things: empty it first.');
    });
    // only the reactions whose text names a removed alias
    var named = new RegExp('["\',>](?:' + Array.from(S).map(q).join('|') + ')["\',<]'), rids = [], i = 0, o;
    while ((o = t.indexOf('<reaction ', i)) >= 0) { var e = t.indexOf('</reaction>', o); if (named.test(t.slice(o, e))) rids.push(at(head(t, [o]), 'id')); i = e; }
    rids.forEach(function (rid) {
      var R = parts(t, rid), al = function (p) { return at(p.tag, 'alias'); };
      if (R.type === 'BOOLEAN_LOGIC_GATE' && !R.bp.map(al).some(S.has, S)) {
        R.br.map(al).filter(S.has, S).forEach(function (a) { if (isReaction(t, rid)) t = gateInputRemove(t, rid, a); });
        return;
      }
      if (R.br.concat(R.bp).map(al).some(S.has, S)) { t = dropReaction(t, rid); return; }
      for (;;) {   // one line at a time, the reaction read again after each: gates first (their inputs' lines go with them)
        R = parts(t, rid);
        var gi = R.mods.findIndex(function (m) { return isGate(m) && at(m.tag, 'aliases').split(',').some(S.has, S); });
        if (gi >= 0) { t = gateInputRemove(t, rid + '|m' + gi, at(R.mods[gi].tag, 'aliases').split(',').filter(S.has, S)[0]); continue; }
        var mi = R.mods.findIndex(function (m) { return S.has(at(m.tag, 'aliases')); });
        if (mi >= 0) { t = dropMods(t, rid, [mi]); continue; }
        var ri = R.rl.findIndex(function (p) { return S.has(al(p)); }), pi = R.pl.findIndex(function (p) { return S.has(al(p)); });
        if (ri < 0 && pi < 0) break;
        t = removeLine(t, rid, ri >= 0 ? 'r' + ri : 'p' + pi);
      }
    });
    list.forEach(function (A) { t = drop(t, alias(t, A.id).sp, [CD + ALIASES[A.kind]]); });
    gone.forEach(function (sid) {
      var P = species(t, sid);
      t = drop(t, P.sp, [P.inc ? CD + 'listOfIncludedSpecies' : 'listOfSpecies']);
      if (P.ref) t = unused(t, P.ref);
    });
    list.forEach(function (A) {
      if (A.kind === 'compartmentAlias' && t.indexOf(' compartment="' + A.compartment + '"') < 0)
        t = drop(t, span(t, '<compartment(?=\\s)[^>]*\\sid="' + q(A.compartment) + '"'), ['listOfCompartments']);
    });
    return t;
  }

  // ---- species' features ----
  // an element put into a species' state at its place among homodimer, listOfModifications, listOfStructuralStates
  // (CellDesigner's order); a missing state made where the converter's identity() puts it: after the reference, before
  // a name
  var ORDER = ['<celldesigner:homodimer>', '<celldesigner:listOfModifications>', '<celldesigner:listOfStructuralStates>'];
  function toState(t, sid, item) {
    var S = species(t, sid), st = span(t, '<celldesigner:state>', S.sp[0], S.sp[1]);
    if (!st) {
      var si = span(t, '<celldesigner:speciesIdentity>', S.sp[0], S.sp[1]), nm = t.indexOf('<celldesigner:name>', si[0]);
      var e = nm >= 0 && nm < si[1] ? nm : si[1] - '</celldesigner:speciesIdentity>'.length;
      return put(t, e, e, list(t, CD + 'state', item) + '\n');
    }
    var later = ORDER.slice(ORDER.findIndex(function (k) { return item.indexOf(k) === 0; }) + 1), at_ = st[1] - '</celldesigner:state>'.length;
    later.forEach(function (k) { var i = t.indexOf(k, st[0]); if (i >= 0 && i < at_) at_ = i; });
    return put(t, at_, at_, item + '\n');
  }
  function inState(t, sid, open) { var S = species(t, sid), st = span(t, '<celldesigner:state>', S.sp[0], S.sp[1]); return st && span(t, open, st[0], st[1]); }
  function protein(t, id) {
    var A = entity(t, id);
    if (!REF[A.cls] || REF[A.cls][0] !== 'protein' || !A.s.ref) fail('Residues belong to proteins; this is ' + an(kind(A.cls || 'species')) + '.');
    return A;
  }
  var OPEN = /<celldesigner:protein [^>]*[^/]>\s+<\/celldesigner:protein>/;   // a protein with no residues written open
  function residues(t, A) { return all(t, '<celldesigner:modificationResidue ', reference(t, A.s.ref)); }
  // a residue on the protein's reference (its sites belong to the protein, shared by all its species) at the first
  // free place of CellDesigner's default (left) and the corners, the top middle left for a unit of information; its state
  // on this species
  function residue(t, id, o) {
    var A = protein(t, id), state = o.state || 'empty', rs = residues(t, A);
    if (STATES.indexOf(state) < 0) fail('CellDesigner has no residue state ' + state + '.');
    var used = rs.map(function (r) { return F(at(r.tag, 'angle')); }), P = Math.PI;
    var ang = [P, 0, 3 * P / 4, P / 4, 5 * P / 4, 7 * P / 4, 3 * P / 2].filter(function (a) { return !used.some(function (u) { return Math.abs(u - a) < 0.3; }); })[0];
    var rid = next(t, 'rs'), p = reference(t, A.s.ref), el = '<celldesigner:modificationResidue angle="' + repr(ang === undefined ? P : ang) + '" id="' + rid + '"' +
      (o.name ? ' name="' + esc(o.name) + '"' : '') + ' side="none"/>';
    if (t[p[1] - 2] === '/') t = put(t, p[1] - 2, p[1], '>' + (OPEN.test(t) ? '' : '\n') + list(t, CD + 'listOfModificationResidues', el) + '\n</celldesigner:protein>');
    else t = add(t, CD + 'listOfModificationResidues', el, p[0], p[1], p[1] - '</celldesigner:protein>'.length);
    return { text: setState(t, A.species, rid, state), residue: rs.length };
  }
  function setState(t, sid, rid, state) {
    var m = inState(t, sid, '<celldesigner:modification(?=\\s)[^>]*\\sresidue="' + q(rid) + '"');
    if (m) return attrs(t, m[0], [['state', state]]);
    var item = '<celldesigner:modification residue="' + rid + '" state="' + state + '"/>', l = inState(t, sid, '<celldesigner:listOfModifications>');
    return l ? add(t, CD + 'listOfModifications', item, l[0], l[1]) : toState(t, sid, list(t, CD + 'listOfModifications', item));
  }
  function residueAt(t, id, n) { var A = protein(t, id), r = residues(t, A)[n]; if (!r) fail('No residue ' + n + ' on this protein.'); return [A, at(r.tag, 'id'), r]; }
  function residueState(t, id, n, state) {
    if (STATES.indexOf(state) < 0) fail('CellDesigner has no residue state ' + state + '.');
    var r = residueAt(t, id, n);
    return setState(t, r[0].species, r[1], state);
  }
  // a residue removed from the protein, and its state from every species of the protein
  function residueRemove(t, id, n) {
    var r = residueAt(t, id, n), ref = r[0].s.ref;
    users(t, ref).forEach(function (sid) {
      var s = inState(t, sid, '<celldesigner:modification(?=\\s)[^>]*\\sresidue="' + q(r[1]) + '"');
      if (s) t = drop(t, s, [CD + 'listOfModifications', CD + 'state']);
    });
    var p = reference(t, ref);
    t = drop(t, span(t, '<celldesigner:modificationResidue(?=\\s)[^>]*\\sid="' + q(r[1]) + '"', p[0], p[1]), [CD + 'listOfModificationResidues']);
    p = reference(t, ref);
    // a protein left with no residues written short again (as CellDesigner does), unless the file writes such ones open
    // and it was so (as list() and drop() tell lists apart)
    var body = t.slice(t.indexOf('>', p[0]) + 1, p[1] - '</celldesigner:protein>'.length);
    return body.trim() || body && OPEN.test(t.slice(0, p[0]) + t.slice(p[1])) ? t : put(t, p[0], p[1], head(t, p).slice(0, -1) + '/>');
  }
  // the one structural state of a species (free text) and its place on every alias (CellDesigner's default: the top)
  function structural(t, id, txt, replace) {
    var A = entity(t, id), sid = A.species, st = inState(t, sid, '<celldesigner:listOfStructuralStates>');
    if (A.cls === 'DEGRADED') fail('A degraded species has no structural state.');
    if (txt == null || txt === '') {
      if (!st) return t;
      t = drop(t, st, [CD + 'state']);
      aliasesOf(t, sid).forEach(function (a) { var B = alias(t, a), s = span(t, '<celldesigner:structuralState ', B.sp[0], B.sp[1]); if (s) t = cut(t, s); });
      return t;
    }
    if (st && !replace) fail('This species already has a structural state; CellDesigner keeps one free text there.');
    if (st) return attrs(t, span(t, '<celldesigner:structuralState ', st[0], st[1])[0], [['structuralState', esc(txt)]]);
    t = toState(t, sid, list(t, CD + 'listOfStructuralStates', '<celldesigner:structuralState structuralState="' + esc(txt) + '"/>'));
    aliasesOf(t, sid).forEach(function (a) {
      var B = alias(t, a), u = t.indexOf('<celldesigner:usualView>', B.sp[0]);
      if (!span(t, '<celldesigner:structuralState ', B.sp[0], B.sp[1]) && u >= 0 && u < B.sp[1]) t = put(t, u, u, '<celldesigner:structuralState angle="1.5707963267948966"/>\n');
    });
    return t;
  }
  // the one unit of information of an alias, as the converter writes it (cd_info): ct:gene as prefix ct, N:4 as prefix N,
  // any other text as "free input"; removed, written empty where the file writes empty ones, else taken out
  function info(t, id, txt, replace) {
    var A = alias(t, id), s = span(t, '<celldesigner:info ', A.sp[0], A.sp[1]), angle = s ? at(head(t, s), 'angle') : DOWN;
    var u = txt == null || txt === '' ? null : /^ct:/.test(txt) ? ['ct', txt.slice(3)] : /^N:\d+$/.test(txt) ? ['N', txt.slice(2)] : ['free input', txt];
    if (u && s && at(head(t, s), 'state') === 'open' && !replace) fail('This entity already has a unit of information; CellDesigner keeps one.');
    var el = '<celldesigner:info state="' + (u ? 'open" prefix="' + esc(u[0]) + '" label="' + esc(u[1]) : 'empty') + '" angle="' + angle + '"/>';
    if (!u && s) return /<celldesigner:info state="empty"/.test(t.slice(0, s[0]) + t.slice(s[1])) ? put(t, s[0], s[1], el) : cut(t, s);
    if (s) return put(t, s[0], s[1], el);
    var e = A.sp[1] - ('</celldesigner:' + A.kind + '>').length;
    return u ? put(t, e, e, el + '\n') : t;
  }
  // a multimer of n (1: none): homodimer n on the species, and every alias of it grown 6 a unit so its front shape keeps
  // its size (cdrender's and CellDesigner's front: the box less 6 per unit beyond one)
  function homodimer(t, id, n) {
    var A = entity(t, id), h = inState(t, A.species, '<celldesigner:homodimer>'), was = h ? +/>(\d+)</.exec(t.slice(h[0], h[1]))[1] : 1;
    n = +n;
    if (!(n >= 1 && n === Math.floor(n))) fail('A multimer counts 1 or more.');
    if (A.cls === 'DEGRADED') fail('A degraded species is no multimer.');
    if (n === was) return t;
    var el = '<celldesigner:homodimer>' + n + '</celldesigner:homodimer>';
    t = h ? (n > 1 ? put(t, h[0], h[1], el) : drop(t, h, [CD + 'state'])) : toState(t, A.species, el);
    aliasesOf(t, A.species).forEach(function (a) {
      var B = alias(t, a), d = 6 * (n - was), b = span(t, '<celldesigner:bounds ', B.sp[0], B.sp[1]);
      t = attrs(t, b[0], [['w', num(B.box[2] + d)], ['h', num(B.box[3] + d)]]);
      var u = span(t, '<celldesigner:usualView>', B.sp[0]), bs = u && span(t, '<celldesigner:boxSize ', u[0], u[1]);
      if (bs) t = attrs(t, bs[0], [['width', num(B.box[2] + d)], ['height', num(B.box[3] + d)]]);
    });
    return t;
  }

  // a reaction as the editor's menus need it: its type, its modifications' types (a gate's: BOOLEAN_LOGIC_GATE_*), the
  // gate between entities with its kind and output, and its added reactants' and products' aliases
  function about(t, rid) {
    var R = parts(t, rid), g = R.gm.filter(isGate)[0];
    // reversible: null for a type that may not be reversible
    return { type: R.type, reversible: TWO_WAY.indexOf(R.type) < 0 ? null : at(head(t, R.rs), 'reversible') !== 'false',
      mods: R.mods.map(function (m) { return at(m.tag, 'type'); }), gate: g ? { kind: at(g.tag, 'type').slice(19), out: at(g.tag, 'modificationType') } : null,
      gates: R.mods.map(function (m) { return isGate(m) ? { kind: at(m.tag, 'type').slice(19), out: at(m.tag, 'modificationType'), inputs: at(m.tag, 'aliases').split(',') } : null; }),
      modAliases: R.mods.map(function (m) { return at(m.tag, 'aliases'); }), inputs: g ? at(g.tag, 'aliases').split(',') : null,
      rl: R.rl.map(function (p) { return at(p.tag, 'alias'); }), pl: R.pl.map(function (p) { return at(p.tag, 'alias'); }) };
  }
  // ---- complex membership: a species dropped on a complex joins it, one taken out with Shift leaves it ----
  // A member is an included species, as the converter's write() writes it (checked in CellDesigner 4.4.2): its alias
  // carries complexSpeciesAlias and its offset in the complex, no compartmentAlias (its members none either: the
  // converter's form, as species() makes a member); its species sits in listOfIncludedSpecies with the notes' text and the RDF in celldesigner:notes, the
  // complex's species and the identity (class, reference, residues, name) in celldesigner:annotation. Same ids, so
  // nothing else changes. joinable(t, alias, cx) -> '' or why not: 'kind' (a compartment, a phenotype, a degraded
  // species), 'member' (in a complex already), 'inside' (the complex is inside it), 'copies' (its species drawn more
  // than once: a member is one alias), 'lines' (a line goes to a complex, never to its member)
  var NO_MEMBER = /^(PHENOTYPE|DEGRADED)$/;
  function joinable(t, id, cx) {
    var A = alias(t, id), C = alias(t, cx);
    if (C.kind !== 'complexSpeciesAlias') fail('That is not a complex.');
    if (!A.species || NO_MEMBER.test(A.cls)) return 'kind';
    if (A.complex) return 'member';
    for (var P = C; P; P = P.complex ? alias(t, P.complex) : null) if (P.id === A.id) return 'inside';
    if (aliasesOf(t, A.species).length > 1) return 'copies';
    var lr = span(t, '<listOfReactions[\\s>]'), named = new RegExp('["\',>](?:' + q(A.id) + '|' + q(A.species) + ')["\',<]');
    return lr && named.test(t.slice(lr[0], lr[1])) ? 'lines' : '';
  }
  function parts_(t, S) {   // a species' identity, its notes' text (the RDF left out) and its RDF
    var seg = t.slice(S.sp[0], S.sp[1]), rdf = /<rdf:RDF[\s>][\s\S]*?<\/rdf:RDF>/.exec(seg), body = /<body>([\s\S]*?)<\/body>/.exec(seg);
    var idn = /<celldesigner:speciesIdentity>[\s\S]*?<\/celldesigner:speciesIdentity>/.exec(seg);
    if (!idn) fail('Its species has no CellDesigner identity in the file.');
    return { identity: idn[0], rdf: rdf ? rdf[0] : '',
      text: body ? body[1].replace(/<rdf:RDF[\s>][\s\S]*?<\/rdf:RDF>/, '').replace(/\s+$/, '') : '' };
  }
  function html(text, rdf) { return '<html xmlns="http://www.w3.org/1999/xhtml">\n<head>\n<title/>\n</head>\n' + (text || rdf ? '<body>' + (rdf ? (text ? text + '\n' : '') + rdf + '\n' : text) + '</body>' : '<body/>') + '\n</html>'; }
  function carry(t, id, ca) {   // the members carrying a compartmentAlias (nested ones too): ca, or none (null)
    ed.carriers(t, id).forEach(function (m) { if (m[1] !== ca) t = attrs(t, alias(t, m[0]).sp[0], [['compartmentAlias', ca]]); });
    return t;
  }
  function inner(t, id, P) {   // the alias's offset from P's top left (its usual view), [0, 0] with none
    var A = alias(t, id), ip = span(t, '<celldesigner:innerPosition ', span(t, '<celldesigner:usualView>', A.sp[0], A.sp[1])[0]);
    return ip ? attrs(t, ip[0], [['x', num(P ? A.box[0] - P.box[0] : 0)], ['y', num(P ? A.box[1] - P.box[1] : 0)]]) : t;
  }
  function join(t, id, cx) {
    var why = joinable(t, id, cx);
    if (why) fail({ kind: 'Only a molecule goes into a complex.', member: 'It is in a complex already.', inside: 'A complex does not go into itself.',
      copies: 'It is drawn more than once: a complex member is drawn once.', lines: 'It has lines: a line goes to a complex, never to its member.' }[why]);
    var A = alias(t, id), C = alias(t, cx), S = species(t, A.species), P = parts_(t, S);
    var inc = '<celldesigner:species id="' + S.id + '" name="' + S.name + '">\n<celldesigner:notes>\n' + html(P.text, P.rdf) + '\n</celldesigner:notes>\n<celldesigner:annotation>\n' +
      '<celldesigner:complexSpecies>' + C.species + '</celldesigner:complexSpecies>\n' + P.identity + '\n</celldesigner:annotation>\n</celldesigner:species>';
    t = drop(t, S.sp, ['listOfSpecies']);
    var mine = t.indexOf('<celldesigner:complexSpecies>' + S.id + '</');   // a complex's species before its members' (as CellDesigner lists them)
    if (mine >= 0) { var o = t.lastIndexOf('<celldesigner:species ', mine); t = put(t, o, o, inc + '\n'); }
    else t = add(t, CD + 'listOfIncludedSpecies', inc, 0, t.indexOf(EXT), after(t, '>', t.indexOf('<celldesigner:modelDisplay ')));
    if (A.kind === 'complexSpeciesAlias') {   // a complex, with the complexes inside it, after the complex now holding it
      var sub = [id];
      for (var k = 0; k < sub.length; k++) inside(t, 'complexSpeciesAlias', sub[k]).forEach(function (m) { if (alias(t, m).kind === 'complexSpeciesAlias') sub.push(m); });
      if (sub.some(function (m) { return alias(t, m).sp[0] < C.sp[0]; })) {
        var txt = sub.map(function (m) { var sp = alias(t, m).sp; return t.slice(sp[0], eol(t, sp[1])); }).join('');
        sub.forEach(function (m) { t = cut(t, alias(t, m).sp); });
        var c = alias(t, cx); t = put(t, eol(t, c.sp[1]), eol(t, c.sp[1]), txt);
      }
    }
    t = attrs(t, alias(t, id).sp[0], [['complexSpeciesAlias', cx], ['compartmentAlias', null]]);
    return carry(inner(t, id, C), id, null);
  }
  // leave(t, alias, ca): a member out of its complex, into compartment alias ca (null: none), as a species of the map,
  // inside or transmembrane as its box lies in ca's (cd_edit's place())
  function leave(t, id, ca) {
    var A = alias(t, id), K = ca ? alias(t, ca) : null;
    if (!A.complex) fail('It is in no complex.');
    if (K && K.kind !== 'compartmentAlias') fail('That is not a compartment.');
    var S = species(t, A.species), P = parts_(t, S), pos = K && !ed.inside(A.box, K.box) ? 'transmembrane' : 'inside';
    var sp = '<species metaid="' + S.id + '" id="' + S.id + '" name="' + S.name + '" compartment="' + (K ? K.compartment : 'default') + '" initialAmount="0">\n' +
      (P.text ? '<notes>\n' + html(P.text, '') + '\n</notes>\n' : '') + '<annotation>\n<celldesigner:extension>\n<celldesigner:positionToCompartment>' + pos +
      '</celldesigner:positionToCompartment>\n' + P.identity + '\n</celldesigner:extension>\n' + (P.rdf ? P.rdf + '\n' : '') + '</annotation>\n</species>';
    t = drop(t, S.sp, [CD + 'listOfIncludedSpecies']);
    t = add(t, 'listOfSpecies', sp, 0, t.length, after(t, '</listOfCompartments>'));
    t = attrs(t, alias(t, id).sp[0], [['complexSpeciesAlias', null], ['compartmentAlias', K ? K.id : null]]);
    return carry(inner(t, id, K), id, K ? K.id : null);
  }
  // what an alias is: its class (COMPLEX, PROTEIN, ...; null for a compartment), its species' name, the complex holding it
  // the colour most species of a class already have on the map (their usual view's paint), or null when it has none;
  // on a tie the colour that reached the top count first. One pass over the species, one over the aliases (a large
  // map, 2 MB, in a few ms); the last map's answer kept, as the palette asks on every drag and drop
  var cc = { t: null, n: null };
  function classColour(t, cls) {
    if (cc.t !== t) {
      var kind = {}, n = {}, m, re = /<(species|celldesigner:species)(?=\s)[^>]*\sid="([^"]+)"[\s\S]*?<\/\1>/g;
      while ((m = re.exec(t))) { var c = /<celldesigner:class>([^<]*)</.exec(m[0]); if (c) kind[m[2]] = c[1]; }
      re = /<celldesigner:(speciesAlias|complexSpeciesAlias)(?=\s)[^>]*\sspecies="([^"]+)"[\s\S]*?<\/celldesigner:\1>/g;
      var sz = {};
      while ((m = re.exec(t))) {
        var k = kind[m[2]], b = k && /<celldesigner:bounds [^>]*\sw="([^"]+)"[^>]*\sh="([^"]+)"/.exec(m[0]);
        if (b) { var Z = sz[k] || (sz[k] = { all: 0, best: null }), key = F(b[1]) + ',' + F(b[2]); Z.all++; Z[key] = (Z[key] || 0) + 1; if (!Z.best || Z[key] > Z[Z.best]) Z.best = key; }
        var u = k && /<celldesigner:usualView>[\s\S]*?<celldesigner:paint color="([0-9a-fA-F]{8})"/.exec(m[0]);
        if (!u) continue;
        var N = n[k] || (n[k] = { best: null }), col = u[1].toLowerCase();
        N[col] = (N[col] || 0) + 1;
        if (!N.best || N[col] > N[N.best]) N.best = col;
      }
      cc = { t: t, n: n, sz: sz };
    }
    return cc.n[cls] ? cc.n[cls].best : null;
  }
  // the size most species of a class have on the map ([w, h], the same pass), or null: none of that class, or no size
  // shared by two of them while there are several (complexes, sized to their members, mostly differ)
  function classSize(t, cls) {
    classColour(t, null);
    var Z = cc.sz[cls];
    return Z && Z.best && (Z[Z.best] > 1 || Z.all === 1) ? Z.best.split(',').map(Number) : null;
  }
  // every class's colours and how many species have each: { PROTEIN: { ffc8d8eb: 12, ... }, ... } (the same pass)
  function classColours(t) {
    classColour(t, null);
    var o = {};
    Object.keys(cc.n).forEach(function (k) { o[k] = {}; Object.keys(cc.n[k]).forEach(function (c) { if (c !== 'best') o[k][c] = cc.n[k][c]; }); });
    return o;
  }
  // a species alias's look as Properties shows it (with its class): its fill (#rrggbb, CellDesigner's paint without the alpha), border
  // width (singleLine) and multimer (its species' homodimer count above 1), all from the usual view
  function look(t, id) {
    var C = alias(t, id);
    if (C.kind === 'compartmentAlias') { var cp = /<celldesigner:paint color="([0-9a-fA-F]{8})"/.exec(t.slice(C.sp[0], C.sp[1])); return { fill: cp ? '#' + cp[1].slice(2).toLowerCase() : '', width: 1, multimer: false, cls: 'COMPARTMENT' }; }
    var A = entity(t, id), u = span(t, '<celldesigner:usualView>', A.sp[0], A.sp[1]), seg = u ? t.slice(u[0], u[1]) : '';
    var p = /<celldesigner:paint color="([0-9a-fA-F]{8})"/.exec(seg), w = /<celldesigner:singleLine width="([^"]*)"/.exec(seg), h = inState(t, A.species, '<celldesigner:homodimer>');
    return { fill: p ? '#' + p[1].slice(2).toLowerCase() : '', width: w ? F(w[1]) : 1, multimer: h ? +/>(\d+)</.exec(t.slice(h[0], h[1]))[1] > 1 : false, cls: A.cls };
  }
  // the fill (#rrggbb, written opaque) and the border width of one species alias, in its usual view; the brief view kept
  function restyle(t, id, o) {
    var C = alias(t, id);
    if (C.kind === 'compartmentAlias') {   // its colour only (CellDesigner's paint, the band and the lines drawn from it)
      if (o.width != null) fail('A compartment keeps its two lines.');
      if (o.fill == null) return t;
      if (!/^#[0-9a-fA-F]{6}$/.test(o.fill)) fail('A fill is a colour #rrggbb.');
      var cs = span(t, '<celldesigner:paint ', C.sp[0], C.sp[1]);
      if (!cs) fail('No colour on ' + id + '.');
      return attrs(t, cs[0], [['color', 'ff' + o.fill.slice(1).toLowerCase()]]);
    }
    var A = entity(t, id);
    if (A.cls === 'DEGRADED' && o.fill != null) fail('A degraded species keeps CellDesigner\u2019s look.');
    var set = function (open, k, v) {
      var B = alias(t, id), u = span(t, '<celldesigner:usualView>', B.sp[0], B.sp[1]), s = u && span(t, open, u[0], u[1]);
      if (!s) fail('No usual view on ' + id + '.');
      t = attrs(t, s[0], [[k, v]]);
    };
    if (o.fill != null) {
      if (!/^#[0-9a-fA-F]{6}$/.test(o.fill)) fail('A fill is a colour #rrggbb.');
      set('<celldesigner:paint ', 'color', 'ff' + o.fill.slice(1).toLowerCase());
    }
    if (o.width != null) {
      if (!(o.width > 0 && o.width <= 20)) fail('A border width is above 0 and 20 at most.');
      set('<celldesigner:singleLine ', 'width', num(o.width));
    }
    return t;
  }
  // a line's colour (#rrggbb): a modifier's own line (rid|mN), else its reaction's, one colour for the whole reaction (its
  // main line, a reduced notation's line, added reactants and products: cdrender draws them all in it). A logic gate's
  // lines, its inputs included, are drawn in the reaction's colour: none of their own (null from lineColour)
  function lineAt(t, eid) {
    var m = /^(.*)\|(a|b|i\d+|m\d+|r\d+|p\d+)$/.exec(eid);
    if (!m) return null;
    var R = parts(t, m[1]), k = m[2][0], n = +m[2].slice(1), own = k === 'm' ? R.mods[n] : null;
    if (k === 'm' && (!own || isGate(own) || owner(R, n) !== null)) return null;
    if (own) return span(t, '<celldesigner:line ', own.sp[0], own.sp[1]);
    var skip = ['listOfModification', 'listOfReactantLinks', 'listOfProductLinks', 'listOfGateMember'].map(function (l) { return span(t, '<celldesigner:' + l + '>', R.x[0], R.x[1]); }).filter(Boolean);
    return all(t, '<celldesigner:line ', R.x).map(function (L) { return L.sp; }).filter(function (L) { return !skip.some(function (q) { return L[0] >= q[0] && L[0] < q[1]; }); })[0] || null;
  }
  function lineColour(t, eid) { var L = lineAt(t, eid), c = L && at(head(t, L), 'color'); return L ? '#' + (c && /^[0-9a-fA-F]{8}$/.test(c) ? c.slice(2).toLowerCase() : '000000') : null; }
  function recolourLine(t, eid, c) {   // c #rrggbb, written opaque
    if (!/^#[0-9a-fA-F]{6}$/.test(c || '')) fail('A line colour is a colour #rrggbb.');
    var L = lineAt(t, eid), col = 'ff' + c.slice(1).toLowerCase();
    if (!L) fail('A logic gate\u2019s lines take their reaction\u2019s colour.');
    t = attrs(t, L[0], [['color', col]]);
    if (/\|m\d+$/.test(eid)) return t;
    // the whole reaction: its added reactants' and products' lines too, so CellDesigner shows it in one colour as well
    var R = parts(t, eid.replace(/\|[^|]*$/, ''));
    R.rl.concat(R.pl).map(function (l) { return l.sp; }).sort(function (p, r) { return r[0] - p[0]; }).forEach(function (sp) { var s2 = span(t, '<celldesigner:line ', sp[0], sp[1]); if (s2) t = attrs(t, s2[0], [['color', col]]); });
    return t;
  }
  function aliasInfo(t, id) {
    var A = alias(t, id), C = A.kind === 'compartmentAlias' ? span(t, '<compartment(?=\\s)[^>]*\\sid="' + q(A.compartment) + '"') : null;
    var hd = A.s && /<celldesigner:homodimer>(\d+)</.exec(t.slice(A.s.sp[0], A.s.sp[1]));
    return { kind: A.kind, cls: A.cls || null, id: A.species || A.compartment, name: A.s ? A.s.name : C ? at(head(t, C), 'name') : null, complex: A.complex, box: A.box, homodimer: hd ? +hd[1] : 1 };
  }
  var api = { LOOK: LOOK, COMP: COMP, lineColour: lineColour, recolourLine: recolourLine, PROCESS: PROCESS, REDUCED: REDUCED, sbgn: sbgn, MODS: MODS, NEED: NEED, about: about, aliasInfo: aliasInfo, classColour: classColour, classColours: classColours, classSize: classSize, empty: empty, species: newSpecies, compartment: compartment, rename: rename, retype: retype, remove: remove, reaction: reaction, reduced: reduced,
    reactant: reactant, product: product, modifier: modifier, reactionType: reactionType, reversible: reversible, modifierType: modifierType, removeLine: removeLine,
    gate: gate, gateInput: gateInput, gateInputRemove: gateInputRemove, gateType: gateType, residue: residue, residueState: residueState,
    residueRemove: residueRemove, structural: structural, info: info, homodimer: homodimer, look: look, restyle: restyle, cdName: cdName, joinable: joinable, join: join, leave: leave };
  if (node) module.exports = api; else root.cd_make = api;
})(typeof window !== 'undefined' ? window : globalThis);
