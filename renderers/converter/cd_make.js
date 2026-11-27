// cd_make: makes and changes things in a CellDesigner 4.x file (SBML L2V4 with CellDesigner's extension), the
// editor's writer for new species, reactions and gates; JavaScript only. Every function takes the CellDesigner text and
// splices into it only what changes (cd_edit's Text), so the rest stays byte for byte and the file opens in CellDesigner
// 4.4 as it was left; something added and removed again gives the text back as it was, lists written in the file's own
// form. Each element is written as CellDesigner 4.4 saves it (its saves of the gate cases and the converter's test files)
// and as the converter's celldesigner.py write() writes it (checked against CellDesigner 4.4.2): one element per line,
// no indentation, the same order and defaults; inserted lines take the file's line ends. Ids as CellDesigner makes them
// (s, sa, csa, c, ca, re, pr, gn, rn, rs), the number after the highest one in the text. Everything refused throws an
// Error whose message is the reason: a rule of the format marked refused (the editor stays silent), a fault not.
//   empty(opt) -> text                                     opt: { id, W, H }
//   species(t, { cls, name, box, compartment, complex }) -> { text, alias, species }   (compartment left out: the one round its box)
//   compartment(t, { name, box, oval }) -> { text, alias, compartment }   oval: CellDesigner's OVAL class, else SQUARE
//   rename(t, alias, name), retype(t, alias, cls), remove(t, [alias, ...]) -> text
//   namePlace(t, alias, one) -> one of cdrender's NAME_PLACES or ''; nameAt(t, alias, place) -> text; nameInfo(t, alias)   (a compartment's name)
//   reaction(t, { type, from, to }), reduced(t, { type, from, to }) -> { text, reaction }
//   reactant(t, rid, alias), product(t, rid, alias), modifier(t, rid, alias, type) -> { text, part }   (part: r<n>, p<n>, m<n>)
//   reactionType(t, rid, type), reversible(t, rid, on), modifierType(t, rid, n, type), removeLine(t, rid, part?) -> text
//   gate(t, { kind, inputs, target, output }) -> { text, reaction, gate, at }   (gate: '<rid>|m<n>' on a reaction, '<rid>' between entities)
//   gateInput(t, gate, alias) -> { text, part } (part null between entities); gateInputRemove(t, gate, alias), gateType(t, gate, { kind, output }) -> text
//   residue(t, alias, { name, state }) -> { text, residue }; residueState(t, alias, n, state), residueRemove(t, alias, n) -> text
//   structural(t, alias, text|null, replace), info(t, alias, text|[prefix, label]|null, replace), homodimer(t, alias, n) -> text; infoUnit(text) -> [prefix, label] | { bad }; INFO
//   residueName(t, alias, n, name), residueMove(t, alias, n, angle), structuralMove(t, alias, angle) -> text; features(t, alias) -> { protein, residues, structural, info: { text, prefix, label }, homodimer }
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
  var KEEP = /^celldesigner:listOf(CompartmentAliases|ComplexSpeciesAliases|SpeciesAliases|Proteins|Genes|RNAs|AntisenseRNAs|Layers)$/;
  var DOWN = '-1.5707963267948966', LINE = '<celldesigner:line width="1.0" color="ff000000"/>';
  // a name as the converter writes it (cd_name, cdrender's NAME), a line break as CellDesigner's _br_
  function unesc(s) { return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }   // an attribute's text as the XML parser reads it
  function cdName(s) { s = String(s).replace(/\r?\n/g, '_br_'); cdr.NAME.forEach(function (n) { s = s.split(n[0]).join(n[1]); }); return s; }
  function esc(s) { return py.escape(s).replace(/"/g, '&quot;'); }
  function fail(s) { throw new Error(s); }
  function refuse(s) { var e = new Error(s); e.refused = true; throw e; }   // a rule of the format, not a fault: the editor says nothing
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
  function entity(t, id) { var A = alias(t, id); if (!A.species) refuse('A compartment has no lines, residues or units.'); return A; }
  // a line's end: never a complex's member, until a CellDesigner save shows how it holds one
  function end(t, id) { var A = entity(t, id); if (A.complex) refuse('A line joins the complex, not one of its members.'); return A; }
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
    var rs = rspan(t, rid), x = span(t, '<celldesigner:extension>', rs[0], rs[1]) || span(t, '<annotation[\\s>]', rs[0], rs[1]);   // CellDesigner 4.0's layout: the annotation itself
    return { id: rid, rs: rs, x: x, type: /<celldesigner:reactionType>([^<]*)</.exec(t.slice(rs[0], rs[1]))[1],
      br: all(t, '<celldesigner:baseReactant[\\s>/]', x), bp: all(t, '<celldesigner:baseProduct[\\s>/]', x),
      rl: all(t, '<celldesigner:reactantLink ', x), pl: all(t, '<celldesigner:productLink ', x),
      mods: all(t, '<celldesigner:modification ', x), gm: all(t, '<celldesigner:GateMember ', x) };
  }
  function process(t, rid) { var R = parts(t, rid); if (FULL.indexOf(R.type) < 0) refuse('Only a reaction with a process square takes this; ' + rid + ' is ' + R.type + '.'); return R; }
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
  // CellDesigner 4.0's layout (SBML Level 2 Version 1, as ACSN's archive keeps it): its elements straight in each
  // annotation, no <celldesigner:extension> around them. The model's lists then end with the model's annotation; what is
  // made here is written with the wrapper and the wrapper taken off again (bare), so the file keeps one layout
  var olderMemo = [null, false];   // the last text asked about: a 4.0 file has no wrapper, so the test reads it all (37 ms on 60 MB)
  function older(t) {
    if (olderMemo[0] !== t) olderMemo = [t, t.indexOf('<celldesigner:extension>') < 0 && t.indexOf('<celldesigner:modelDisplay') >= 0];
    return olderMemo[1];
  }
  function extEnd(t) {
    var i = t.indexOf(EXT);
    if (i >= 0 || !older(t)) return i;
    var m = /<model[\s>]/.exec(t), a = m ? span(t, '<annotation[\\s>]', m.index) : null;
    return a ? a[1] - '</annotation>'.length : -1;
  }
  function bare(r) {
    var off = function (s) { return typeof s === 'string' ? s.replace(/<celldesigner:extension>(\r?\n)?/g, '').replace(/(\r?\n)?<\/celldesigner:extension>/g, '') : s; };   // a file's \r\n line ends too (put)
    if (typeof r === 'string') return off(r);
    if (Array.isArray(r)) return r.map(off);
    if (r && typeof r === 'object' && typeof r.text === 'string') { var o = {}; Object.keys(r).forEach(function (k) { o[k] = k === 'text' ? off(r[k]) : r[k]; }); return o; }
    return r;
  }

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
    // the name at the top middle (cdrender.namePoint: the membrane + 0.5 below the top, 12.5 as the converter writes
    // it), on an oval too; its colour o.colour (eight hex digits), else CellDesigner's yellow
    var npt = cdr.namePoint(b, cdName(o.name || cid), COMP.thickness, 't'), nx = npt[0];
    t = add(t, CD + 'listOfCompartmentAliases', '<celldesigner:compartmentAlias id="' + aid + '" compartment="' + cid + '">\n<celldesigner:class>' + (o.oval ? 'OVAL' : 'SQUARE') + '</celldesigner:class>\n' +
      '<celldesigner:bounds x="' + num(b[0]) + '" y="' + num(b[1]) + '" w="' + num(b[2]) + '" h="' + num(b[3]) + '"/>\n<celldesigner:namePoint x="' + num(nx) +
      '" y="' + num(npt[1]) + '"/>\n<celldesigner:doubleLine thickness="' + num(COMP.thickness) + '" outerWidth="' + num(COMP.outer) + '" innerWidth="' + num(COMP.inner) + '"/>\n<celldesigner:paint color="' + (o.colour || COMP.colour) + '" scheme="Color"/>\n' +
      '<celldesigner:info state="empty" angle="' + DOWN + '"/>\n</celldesigner:compartmentAlias>', 0, t.length, extEnd(t));
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
    return [add(t, CD + r[2], '<celldesigner:' + r[0] + ' id="' + id + '" name="' + name + '" type="' + r[4] + '"/>', 0, t.length, extEnd(t)), id];
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
      if (C.kind !== 'complexSpeciesAlias') refuse('That is not a complex.');
      extra = ' complexSpeciesAlias="' + C.id + '"'; ip = [b[0] - C.box[0], b[1] - C.box[1]];
    } else if (o.compartment || holder(t, b)) {   // in a compartment, given or else the innermost holding its box: its offset
      // from the compartment's top left (CellDesigner's save of estrogen)
      var K = o.compartment ? alias(t, o.compartment) : holder(t, b);
      if (K.kind !== 'compartmentAlias') refuse('That is not a compartment.');
      extra = ' compartmentAlias="' + K.id + '"'; ip = [b[0] - K.box[0], b[1] - K.box[1]]; comp = K.compartment;
    }
    if (REF[cls]) { var rr = referenceFor(t, cls, name); t = rr[0]; ref = rr[1]; }
    t = add(t, CD + ALIASES[cls === 'COMPLEX' ? 'complexSpeciesAlias' : 'speciesAlias'], aliasXml(aid, sid, cls, b, extra, ip, o.colour && o.colour.toLowerCase()), 0, t.length, extEnd(t));
    if (C) {   // an included species, not in listOfSpecies
      t = add(t, CD + 'listOfIncludedSpecies', '<celldesigner:species id="' + sid + '" name="' + name + '">\n<celldesigner:notes>\n<html xmlns="http://www.w3.org/1999/xhtml">\n' +
        '<head>\n<title/>\n</head>\n<body/>\n</html>\n</celldesigner:notes>\n<celldesigner:annotation>\n<celldesigner:complexSpecies>' + C.species +
        '</celldesigner:complexSpecies>\n' + identity(cls, ref, name) + '\n</celldesigner:annotation>\n</celldesigner:species>', 0, extEnd(t),
        after(t, '>', t.indexOf('<celldesigner:modelDisplay ')));   // after the map's size, as CellDesigner writes it
    } else {
      t = add(t, 'listOfSpecies', '<species metaid="' + sid + '" id="' + sid + '" name="' + name + '" compartment="' + comp + '" initialAmount="0">\n<annotation>\n' +
        '<celldesigner:extension>\n<celldesigner:positionToCompartment>inside</celldesigner:positionToCompartment>\n' + identity(cls, ref, name) +
        '\n</celldesigner:extension>\n</annotation>\n</species>', 0, t.length, after(t, '</listOfCompartments>'));
    }
    return { text: grow(t, b), alias: aid, species: sid };
  }
  function noResidues(t, sid) { var l = inState(t, sid, '<celldesigner:listOfModifications>'); return l ? drop(t, l, [CD + 'state']) : t; }   // its residues' states

  // a compartment's name place (cdrender.namePoint): its name as the file has it, its membrane's thickness (12 where
  // absent), whether it is an oval, the place its namePoint is at (one of NAME_PLACES) or '' when elsewhere; one: ''
  // also where places meet (a box too small to tell them apart), so a rename or a new membrane leaves the name as it is
  function compName(t, A) { var C0 = span(t, '<compartment(?=\\s)[^>]*\\sid="' + q(A.compartment) + '"'); return unesc(at(head(t, C0), 'name') || A.compartment); }
  function compThick(t, A) { var m = /<celldesigner:doubleLine\s(?:[^>]*\s)?thickness="([^"]*)"/.exec(t.slice(A.sp[0], A.sp[1])); return m ? F(m[1]) : 12; }
  function compOval(t, A) { return /<celldesigner:class>OVAL</.test(t.slice(A.sp[0], A.sp[1])); }
  function namePlace(t, id, one) {
    var I = nameInfo(t, id);
    return I ? cdr.namePlaceOf(I.box, I.name, I.th, I.np, I.oval, one) || '' : '';
  }
  // what a compartment's name is placed by: its box, name (as the file has it), membrane, oval or not, namePoint; null when it has none
  function nameInfo(t, id) {
    var A = alias(t, id), np = A.kind === 'compartmentAlias' && A.box && span(t, '<celldesigner:namePoint ', A.sp[0], A.sp[1]);
    if (!np) return null;
    var tag = head(t, np);
    return { box: A.box, name: compName(t, A), th: compThick(t, A), oval: compOval(t, A), np: [F(at(tag, 'x')), F(at(tag, 'y'))] };
  }
  // the name put at place p (one of cdrender's NAME_PLACES); a namePoint written after the bounds where the file has none
  function nameAt(t, id, p) {
    var A = alias(t, id);
    if (A.kind !== 'compartmentAlias') refuse('Only a compartment\u2019s name has a place.');
    if (cdr.NAME_PLACES.indexOf(p) < 0) fail('No name place ' + p + '.');
    if (!A.box) fail('No bounds on ' + id + '.');
    var xy = cdr.namePoint(A.box, compName(t, A), compThick(t, A), p, compOval(t, A)), np = span(t, '<celldesigner:namePoint ', A.sp[0], A.sp[1]);
    if (np) return attrs(t, np[0], [['x', num(xy[0])], ['y', num(xy[1])]]);
    var bs = span(t, '<celldesigner:bounds ', A.sp[0], A.sp[1]), e = t.indexOf('>', bs[0]) + 1;
    return put(t, e, e, '\n<celldesigner:namePoint x="' + num(xy[0]) + '" y="' + num(xy[1]) + '"/>');
  }

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
    if (A.kind === 'compartmentAlias') {   // a name at one of the nine places, or at the top middle (cdrender.nameLeft), kept there; one placed elsewhere left
      var pl = namePlace(t, id, true), was = compName(t, A), np = span(t, '<celldesigner:namePoint ', A.sp[0], A.sp[1]), nx0 = np && F(at(head(t, np), 'x'));
      set('<compartment(?=\\s)[^>]*\\sid="' + q(A.compartment) + '"');
      if (pl) return nameAt(t, id, pl);
      if (np && A.box && Math.abs(nx0 - cdr.nameLeft(A.box, was)) < 1) t = attrs(t, span(t, '<celldesigner:namePoint ', alias(t, id).sp[0], alias(t, id).sp[1])[0], [['x', num(cdr.nameLeft(A.box, cdName(name)))]]);
      return t;
    }
    if (A.cls === 'DEGRADED') refuse('A degraded species keeps its id as its name.');
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
    if (cls === 'COMPLEX' || was === 'COMPLEX') refuse('A complex and a single species cannot be changed into one another: delete it and draw anew.');
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
    if (A.id === B.id) refuse('A line needs two different entities.');
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
    if (joined(R).indexOf(id) >= 0) refuse('This entity is already a reactant or product of the reaction.');
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
    t = add(t, CD + 'listOfModification', els.join('\n'), R.x[0], R.x[1], t.lastIndexOf('</', R.x[1] - 1));   // before the extension's end tag, or the annotation's (4.0's layout)
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
      refuse('A ' + R.type + ' cannot become ' + type + ': reactions change among reactions, reduced notation among its own kinds.');
    var s = span(t, '<celldesigner:reactionType>', R.x[0]);
    return put(t, s[0], s[1], '<celldesigner:reactionType>' + type + '</celldesigner:reactionType>');
  }
  // a reaction made reversible or not: CellDesigner's reversible attribute, left out when reversible (SBML's default, as
  // CellDesigner and the converter write it), "false" when not; cdrender then draws a head at its reactants too. Only a
  // reaction of TWO_WAY (reduced notation is a modulation, never reversible)
  function reversible(t, rid, on) {
    var R = parts(t, rid);
    if (TWO_WAY.indexOf(R.type) < 0) refuse('A ' + R.type + ' is not reversible: only a reaction with a process is.');
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
      refuse('This entity already has ' + an(type.toLowerCase().replace(/_/g, ' ')) + ' line to the reaction; a second one could not be told apart.');
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
    if (ins.length < NEED[k]) refuse(an(k).replace(/^a/, 'A') + ' gate needs ' + (NEED[k] === 2 ? 'two inputs.' : 'an input.'));
    if (new Set(o.inputs).size !== ins.length || o.inputs.indexOf(o.target) >= 0) refuse('A gate\'s inputs and its target are different entities.');
    var mean = function (ps) { return [ps.reduce(function (s, p) { return s + p[0]; }, 0) / ps.length, ps.reduce(function (s, p) { return s + p[1]; }, 0) / ps.length]; };
    var C = ins.slice(0, 2).map(centre), type = 'BOOLEAN_LOGIC_GATE_' + k, al = o.inputs.join(','), G, pt;
    if (isReaction(t, o.target)) {   // on a reaction: a BOOLEAN_LOGIC_GATE_* modification listing the inputs, then each input's own
      var R = process(t, o.target), r = square(t, o.target);
      out = out || 'CATALYSIS';   // CellDesigner's default output
      if (!r) refuse('A gate joins a reaction with one reactant and one product.');
      if (MODS.indexOf(out) < 0) refuse('A gate\'s output ' + out + ' is not a modifier type.');
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
    if (REDUCED.indexOf(out) < 0) refuse('A gate\'s output ' + out + ' is not a reduced notation type.');
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
    if (g.inputs.indexOf(id) >= 0 || joined(g.R).indexOf(id) >= 0 && g.n < 0) refuse('This entity is already joined to the gate.');
    if (g.kind === 'NOT') refuse('A NOT gate has one input, and this one has it.');
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
    if (i < 0) refuse('That entity is not an input of the gate.');
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
      if (g.inputs.length < NEED[o.kind]) refuse(an(o.kind).replace(/^a/, 'A') + ' gate needs two inputs.');
      if (o.kind === 'NOT' && g.inputs.length > 1) refuse('A NOT gate has one input; this gate has ' + g.inputs.length + '.');
      t = attrs(t, g.el.sp[0], [['type', 'BOOLEAN_LOGIC_GATE_' + o.kind]]);
    }
    if (o.output && o.output !== g.out) {
      if ((g.n < 0 ? REDUCED : MODS).indexOf(o.output) < 0) refuse('A gate\'s output ' + o.output + ' is not offered here.');
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
          cs.some(function (C) { return within.indexOf(C.compartment) >= 0 && !S.has(C.id); }))) refuse('The compartment still holds other things: empty it first.');
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
    if (!REF[A.cls] || REF[A.cls][0] !== 'protein' || !A.s.ref) refuse('Residues belong to proteins; this is ' + an(kind(A.cls || 'species')) + '.');
    return A;
  }
  var OPEN = /<celldesigner:protein [^>]*[^/]>\s+<\/celldesigner:protein>/;   // a protein with no residues written open
  // the places for a new icon on a species' (front) box w by h, by size (notes/state-crowding.md): inside each side as
  // many as fit a step apart (20: a 16 circle and a 4 gap; step: more for larger icons), spread evenly, and the corners;
  // in the order of the places most used on CellDesigner maps: the bottom from the middle outwards (right first), the
  // sides' middles, the bottom corners, the top corners, the top from the middle outwards, the sides' other places
  // (lower first). The editor's create.js svPlaces (and sideSlots for slots) is the SBGN-ML copy (as [rx, ry]); here as CellDesigner's angles (0
  // the right, pi/2 the top: cdrender.onBorder's inverse)
  function placesFor(w, h, step) {
    var S = step || 20, slots = function (L) {
      var n = Math.max(0, Math.floor(L / S + 1e-9) - 1), o = [];
      for (var j = 1; j <= n; j++) o.push(Math.round((-L / 2 + j * L / (n + 1)) * 1e6) / 1e6);
      return o.sort(function (a, b) { return Math.abs(a) - Math.abs(b) || b - a; });
    };
    var bx = slots(w), sy = slots(h), out = [], near = sy.length ? sy.filter(function (d) { return Math.abs(Math.abs(d) - Math.abs(sy[0])) < 1e-6; }) : [0];
    bx.forEach(function (d) { out.push([d / w, 0.5]); });
    near.forEach(function (d) { out.push([0.5, d / h], [-0.5, d / h]); });
    out.push([0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]);
    bx.forEach(function (d) { out.push([d / w, -0.5]); });
    sy.slice(near.length).forEach(function (d) { out.push([0.5, d / h], [-0.5, d / h]); });
    return out.map(ratioAngle);
  }
  function ratioAngle(r) {   // [rx, ry] on the border (y down) as CellDesigner's angle (the editor's cdAngle, onBorder's inverse)
    var fx = Math.max(-0.5, Math.min(0.5, r[0])), fy = Math.max(-0.5, Math.min(0.5, r[1])), H = Math.PI / 2;
    var d = [0.5 - fx, fy + 0.5, fx + 0.5, 0.5 - fy], m = Math.min.apply(null, d), a;
    if (m === d[0]) a = -fy * H; else if (m === d[1]) a = H - fx * H; else if (m === d[2]) a = Math.PI + fy * H; else a = 3 * H + fx * H;
    a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return Math.round(a * 1e6) / 1e6;
  }
  // an alias's box set (x, y, w, h), as homodimer() writes a multimer's: its bounds and its usualView's boxSize; its
  // icons are kept by angle, its lines' ports by place, so they follow
  function bounds(t, id, b) {
    var B = alias(t, id), s = span(t, '<celldesigner:bounds ', B.sp[0], B.sp[1]);
    if (!s) fail('No bounds on ' + id + '.');
    t = attrs(t, s[0], [['x', num(b[0])], ['y', num(b[1])], ['w', num(b[2])], ['h', num(b[3])]]);
    B = alias(t, id);
    var u = span(t, '<celldesigner:usualView>', B.sp[0]), bs = u && u[0] < B.sp[1] && span(t, '<celldesigner:boxSize ', u[0], u[1]);
    if (bs) t = attrs(t, bs[0], [['width', num(b[2])], ['height', num(b[3])]]);
    return t;
  }
  // every alias that shows this protein's residues: the aliases of every species naming its reference
  function proteinAliases(t, id) {
    var A = alias(t, id);
    if (!A.s || !A.s.ref) return [id];
    var out = [];
    users(t, A.s.ref).forEach(function (sid) { aliasesOf(t, sid).forEach(function (a) { if (out.indexOf(a) < 0) out.push(a); }); });
    return out.length ? out : [id];
  }
  function residues(t, A) { return all(t, '<celldesigner:modificationResidue ', reference(t, A.s.ref)); }
  // a residue on the protein's reference (its sites belong to the protein, shared by all its species) at o.angle, else
  // a residue on the protein's reference (its sites belong to the protein, shared by all its species) at o.angle, else
  // at the first place of placesFor on this alias's size no residue takes (by angle alone; the editor gives o.angle, its
  // free test by boxes, cdcreate.js cdRoom); its state on this species
  function residue(t, id, o) {
    var A = protein(t, id), state = o.state || 'empty', rs = residues(t, A);
    if (STATES.indexOf(state) < 0) refuse('CellDesigner has no residue state ' + state + '.');
    var used = rs.map(function (r) { return F(at(r.tag, 'angle')); });
    var ang = o.angle != null ? o.angle : placesFor(A.box ? A.box[2] : 80, A.box ? A.box[3] : 40).filter(function (a) { return !used.some(function (u) { return Math.abs(((u - a) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) < 0.3; }); })[0];
    var rid = next(t, 'rs');
    t = putResidue(t, A.s.ref, '<celldesigner:modificationResidue angle="' + repr(ang === undefined ? 3 * Math.PI / 2 : ang) + '" id="' + rid + '"' +
      (o.name ? ' name="' + esc(o.name) + '"' : '') + ' side="none"/>');
    return { text: setState(t, A.species, rid, state), residue: rs.length };
  }
  function putResidue(t, ref, el) {   // a modificationResidue element added last on the protein ref
    var p = reference(t, ref);
    if (t[p[1] - 2] === '/') return put(t, p[1] - 2, p[1], '>' + (OPEN.test(t) ? '' : '\n') + list(t, CD + 'listOfModificationResidues', el) + '\n</celldesigner:protein>');
    return add(t, CD + 'listOfModificationResidues', el, p[0], p[1], p[1] - '</celldesigner:protein>'.length);
  }
  // once a variable, always a variable: the other protein entries of id's name and type (CellDesigner keeps one per
  // protein; a converted or older file may hold one per species) joined into id's, so its residues are on every species
  // of that name. Their residues are added after id's own (whose order, and so their indices, stay), matched by site
  // name, an unnamed one by its angle; their species name id's protein, their residues' states renamed to match; the
  // entries left unused go. Not a protein: t as it is
  function joinKin(t, id) {
    var A = entity(t, id);
    if (!REF[A.cls] || REF[A.cls][0] !== 'protein' || !A.s.ref) return t;
    var me = A.s.ref, P = head(t, reference(t, me)), name = at(P, 'name'), type = at(P, 'type') || 'GENERIC', l = span(t, '<' + CD + 'listOfProteins[\\s>/]');
    var kin = l ? all(t, '<celldesigner:protein(?=\\s)[^>]*\\sname="' + q(name) + '"', l).map(function (e) { return e.tag; })
      .filter(function (g) { return (at(g, 'type') || 'GENERIC') === type && at(g, 'id') !== me; }).map(function (g) { return at(g, 'id'); }) : [];
    var turn = function (a) { return ((a % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; };
    kin.forEach(function (ref) {
      var map = {};
      all(t, '<celldesigner:modificationResidue ', reference(t, ref)).forEach(function (r) {
        var nm = at(r.tag, 'name'), ang = F(at(r.tag, 'angle')), hit = all(t, '<celldesigner:modificationResidue ', reference(t, me)).filter(function (m) {
          return nm ? at(m.tag, 'name') === nm : !at(m.tag, 'name') && Math.abs(turn(F(at(m.tag, 'angle')) - ang)) < 0.01;
        })[0];
        if (hit) { map[at(r.tag, 'id')] = at(hit.tag, 'id'); return; }
        var rid = next(t, 'rs');
        map[at(r.tag, 'id')] = rid;
        t = putResidue(t, me, r.tag.replace(/\sid="[^"]*"/, ' id="' + rid + '"').replace(/>$/, '/>').replace(/\/\/>$/, '/>'));
      });
      users(t, ref).forEach(function (sid) {
        var S = species(t, sid), s = span(t, '<celldesigner:' + REF[S.cls][1] + '>', S.sp[0], S.sp[1]);
        t = put(t, s[0], s[1], '<celldesigner:' + REF[S.cls][1] + '>' + me + '</celldesigner:' + REF[S.cls][1] + '>');
        var m = inState(t, sid, '<celldesigner:listOfModifications>');
        if (m) t = put(t, m[0], m[1], t.slice(m[0], m[1]).replace(/(\sresidue=")([^"]*)"/g, function (x, a, v) { return a + (map[v] || v) + '"'; }));
      });
      t = unused(t, ref);
    });
    return t;
  }
  function setState(t, sid, rid, state) {
    var m = inState(t, sid, '<celldesigner:modification(?=\\s)[^>]*\\sresidue="' + q(rid) + '"');
    if (m) return attrs(t, m[0], [['state', state]]);
    var item = '<celldesigner:modification residue="' + rid + '" state="' + state + '"/>', l = inState(t, sid, '<celldesigner:listOfModifications>');
    return l ? add(t, CD + 'listOfModifications', item, l[0], l[1]) : toState(t, sid, list(t, CD + 'listOfModifications', item));
  }
  function residueAt(t, id, n) { var A = protein(t, id), r = residues(t, A)[n]; if (!r) fail('No residue ' + n + ' on this protein.'); return [A, at(r.tag, 'id'), r]; }
  function residueState(t, id, n, state) {
    if (STATES.indexOf(state) < 0) refuse('CellDesigner has no residue state ' + state + '.');
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
    if (A.cls === 'DEGRADED') refuse('A degraded species has no structural state.');
    if (txt == null || txt === '') {
      if (!st) return t;
      t = drop(t, st, [CD + 'state']);
      aliasesOf(t, sid).forEach(function (a) { var B = alias(t, a), s = span(t, '<celldesigner:structuralState ', B.sp[0], B.sp[1]); if (s) t = cut(t, s); });
      return t;
    }
    if (st && !replace) refuse('This species already has a structural state; CellDesigner keeps one free text there.');
    if (st) return attrs(t, span(t, '<celldesigner:structuralState ', st[0], st[1])[0], [['structuralState', esc(txt)]]);
    t = toState(t, sid, list(t, CD + 'listOfStructuralStates', '<celldesigner:structuralState structuralState="' + esc(txt) + '"/>'));
    aliasesOf(t, sid).forEach(function (a) {
      var B = alias(t, a), u = t.indexOf('<celldesigner:usualView>', B.sp[0]);
      if (!span(t, '<celldesigner:structuralState ', B.sp[0], B.sp[1]) && u >= 0 && u < B.sp[1]) t = put(t, u, u, '<celldesigner:structuralState angle="1.5707963267948966"/>\n');
    });
    return t;
  }
  // CellDesigner's units of information (its Edit Information window, 4.4.2): a prefix from a fixed list, each of pc, mt
  // and ct with its own fixed labels, N with any label, "free input" any text alone
  var INFO = { pc: ['T', 'V', 'pH'], mt: ['ion', 'rad', 'rna', 'dna', 'prot', 'psac'], ct: ['gene', 'tss', 'coding', 'grr', 'mRNA'] };
  // a unit given as text (scripts, tests; the editor's window gives [prefix, label]): pc:T or ct:mRNA (prefix and label in
  // any case), N:4 (n:4), else free input: [prefix, label]; { bad: why }
  // for a prefix of CellDesigner's with a label it does not have
  function infoUnit(txt) {
    var m = /^\s*([^:\s]+)\s*:\s*(.*?)\s*$/.exec(txt), p = m && m[1].toLowerCase();
    if (m && INFO[p]) {
      var lab = INFO[p].filter(function (l) { return l.toLowerCase() === m[2].toLowerCase(); })[0];
      return lab ? [p, lab] : { bad: 'CellDesigner\'s ' + p + ' takes ' + INFO[p].join(', ') + '.' };
    }
    if (m && p === 'n' && m[2]) return ['N', m[2]];
    return ['free input', txt.trim()];
  }
  // a prefix and label as CellDesigner's window offers them: pc, mt and ct with a label of their own, N and free input
  // with any label; { bad: why } otherwise, null when the label is empty
  function infoPair(q) {
    var p = q[0], l = String(q[1] == null ? '' : q[1]).trim();
    if (INFO[p]) return INFO[p].indexOf(l) >= 0 ? [p, l] : { bad: 'CellDesigner\'s ' + p + ' takes ' + INFO[p].join(', ') + '.' };
    if (p !== 'N' && p !== 'free input') return { bad: 'CellDesigner has no prefix ' + p + '.' };
    return l ? [p, l] : null;
  }
  // the one unit of information of an alias, written as CellDesigner's window writes it (infoUnit, infoPair); removed, written
  // empty where the file writes empty ones, else taken out
  function info(t, id, txt, replace) {
    var A = alias(t, id), s = span(t, '<celldesigner:info ', A.sp[0], A.sp[1]), angle = s ? at(head(t, s), 'angle') : DOWN;
    var u = Array.isArray(txt) ? infoPair(txt) : txt == null || !String(txt).trim() ? null : infoUnit(String(txt));   // [prefix, label] as chosen in a window, or text as typed
    if (u && u.bad) refuse(u.bad);
    if (u && s && at(head(t, s), 'state') === 'open' && !replace) refuse('This entity already has a unit of information; CellDesigner keeps one.');
    var el = '<celldesigner:info state="' + (u ? 'open" prefix="' + esc(u[0]) + '" label="' + esc(u[1]) : 'empty') + '" angle="' + angle + '"/>';
    if (!u && s) return /<celldesigner:info state="empty"/.test(t.slice(0, s[0]) + t.slice(s[1])) ? put(t, s[0], s[1], el) : cut(t, s);
    if (s) return put(t, s[0], s[1], el);
    var e = A.sp[1] - ('</celldesigner:' + A.kind + '>').length;
    return u ? put(t, e, e, el + '\n') : t;
  }
  // a residue's site name, on the protein's reference (every species of the protein shows it); empty: no name
  function residueName(t, id, n, name) {
    var r = residueAt(t, id, n), tag = r[2].tag;
    if (name && at(tag, 'name') == null && / side="/.test(tag)) return put(t, r[2].sp[0], r[2].sp[0] + tag.length, tag.replace(' side="', ' name="' + esc(name) + '" side="'));   // before side, where CellDesigner writes it
    return attrs(t, r[2].sp[0], [['name', name ? esc(name) : null]]);
  }
  // a residue's place: its angle on the protein's reference (CellDesigner keeps it there, so every species of the
  // protein shows it at that place), in radians, 0 the right, pi/2 the top
  function residueMove(t, id, n, angle) {
    var r = residueAt(t, id, n);
    return attrs(t, r[2].sp[0], [['angle', repr(F(angle))]]);
  }
  // the structural state's place on this alias (its angle, as residues'); written where the alias has none
  function structuralMove(t, id, angle) {
    var A = entity(t, id), s = span(t, '<celldesigner:structuralState ', A.sp[0], A.sp[1]);
    if (s) return attrs(t, s[0], [['angle', repr(F(angle))]]);
    var u = t.indexOf('<celldesigner:usualView>', A.sp[0]);
    if (u < 0 || u > A.sp[1]) fail('No view on ' + id + ' to place its structural state.');
    return put(t, u, u, '<celldesigner:structuralState angle="' + repr(F(angle)) + '"/>\n');
  }
  // what an alias carries, for the editor: its residues (a protein's: every residue of the protein, in the reference's
  // order, each with its state on this species), its structural state, its unit of information; texts as typed
  function features(t, id) {
    var A = alias(t, id), out = { protein: false, residues: [], structural: null, info: null, homodimer: 1 };
    if (!A.species) return out;
    var S = A.s, st = span(t, '<celldesigner:state>', S.sp[0], S.sp[1]), body = st ? t.slice(st[0], st[1]) : '', m;
    var hd = /<celldesigner:homodimer>(\d+)</.exec(body);
    if (hd) out.homodimer = +hd[1];
    if (REF[A.cls] && REF[A.cls][0] === 'protein' && S.ref && reference(t, S.ref)) {
      out.protein = true;
      var states = {}, re = /<celldesigner:modification\s[^>]*>/g;
      while ((m = re.exec(body))) states[at(m[0], 'residue')] = at(m[0], 'state');
      residues(t, A).forEach(function (r) {
        var rid = at(r.tag, 'id'), nm = at(r.tag, 'name');
        out.residues.push({ id: rid, name: nm == null ? '' : unesc(nm), angle: F(at(r.tag, 'angle') || 0), state: states[rid] || null });
      });
    }
    var ss = /<celldesigner:structuralState\s[^>]*structuralState="([^"]*)"/.exec(body);
    if (ss) {
      var sa = span(t, '<celldesigner:structuralState ', A.sp[0], A.sp[1]);
      out.structural = { text: unesc(ss[1]), angle: sa ? F(at(head(t, sa), 'angle')) : -Math.PI / 2 };
    }
    var inf = span(t, '<celldesigner:info ', A.sp[0], A.sp[1]), it = inf && head(t, inf);
    if (it && at(it, 'state') === 'open') {
      var pre = unesc(at(it, 'prefix') || ''), lab = unesc(at(it, 'label') || '');
      out.info = { text: pre && pre !== 'free input' ? pre + ':' + lab : lab, prefix: pre || 'free input', label: lab };
    }
    return out;
  }
  // a multimer of n (1: none): homodimer n on the species, and every alias of it grown 6 a unit so its front shape keeps
  // its size (cdrender's and CellDesigner's front: the box less 6 per unit beyond one)
  function homodimer(t, id, n) {
    var A = entity(t, id), h = inState(t, A.species, '<celldesigner:homodimer>'), was = h ? +/>(\d+)</.exec(t.slice(h[0], h[1]))[1] : 1;
    n = +n;
    if (!(n >= 1 && n === Math.floor(n))) refuse('A multimer counts 1 or more.');
    if (A.cls === 'DEGRADED') refuse('A degraded species is no multimer.');
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
    if (C.kind !== 'complexSpeciesAlias') refuse('That is not a complex.');
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
    if (why) refuse({ kind: 'Only a molecule goes into a complex.', member: 'It is in a complex already.', inside: 'A complex does not go into itself.',
      copies: 'It is drawn more than once: a complex member is drawn once.', lines: 'It has lines: a line goes to a complex, never to its member.' }[why]);
    var A = alias(t, id), C = alias(t, cx), S = species(t, A.species), P = parts_(t, S);
    var inc = '<celldesigner:species id="' + S.id + '" name="' + S.name + '">\n<celldesigner:notes>\n' + html(P.text, P.rdf) + '\n</celldesigner:notes>\n<celldesigner:annotation>\n' +
      '<celldesigner:complexSpecies>' + C.species + '</celldesigner:complexSpecies>\n' + P.identity + '\n</celldesigner:annotation>\n</celldesigner:species>';
    t = drop(t, S.sp, ['listOfSpecies']);
    var mine = t.indexOf('<celldesigner:complexSpecies>' + S.id + '</');   // a complex's species before its members' (as CellDesigner lists them)
    if (mine >= 0) { var o = t.lastIndexOf('<celldesigner:species ', mine); t = put(t, o, o, inc + '\n'); }
    else t = add(t, CD + 'listOfIncludedSpecies', inc, 0, extEnd(t), after(t, '>', t.indexOf('<celldesigner:modelDisplay ')));
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
    if (!A.complex) refuse('It is in no complex.');
    if (K && K.kind !== 'compartmentAlias') refuse('That is not a compartment.');
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
  // the colour most compartments on the map have (eight hex digits, small letters), or null: none with a colour
  function compartmentColour(t) {
    var n = {}, best = null, m, re = /<celldesigner:compartmentAlias(?=\s)[\s\S]*?<\/celldesigner:compartmentAlias>/g;
    while ((m = re.exec(t))) {
      var p = /<celldesigner:paint color="([0-9a-fA-F]{8})"/.exec(m[0]), c = p && p[1].toLowerCase();
      if (c) { n[c] = (n[c] || 0) + 1; if (!best || n[c] > n[best]) best = c; }
    }
    return best;
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
    if (C.kind === 'compartmentAlias') {   // its colour and its double line (membrane thickness, outer and inner line widths; CellDesigner's 12, 2, 1 where absent)
      var cs = t.slice(C.sp[0], C.sp[1]), cp = /<celldesigner:paint color="([0-9a-fA-F]{8})"/.exec(cs), dl = /<celldesigner:doubleLine\s[^>]*>/.exec(cs), da = function (k, d) { var m = dl && new RegExp('\\s' + k + '="([^"]*)"').exec(dl[0]); return m ? F(m[1]) : d; };
      return { fill: cp ? '#' + cp[1].slice(2).toLowerCase() : '', width: 1, multimer: false, cls: 'COMPARTMENT', mem: da('thickness', 12), outer: da('outerWidth', 2), inner: da('innerWidth', 1) };
    }
    var A = entity(t, id), u = span(t, '<celldesigner:usualView>', A.sp[0], A.sp[1]), seg = u ? t.slice(u[0], u[1]) : '';
    var p = /<celldesigner:paint color="([0-9a-fA-F]{8})"/.exec(seg), w = /<celldesigner:singleLine width="([^"]*)"/.exec(seg), h = inState(t, A.species, '<celldesigner:homodimer>');
    var fe = span(t, '<celldesigner:font ', A.sp[0], A.sp[1]), fz = fe && /\ssize="([^"]*)"/.exec(t.slice(fe[0], fe[1]));
    return { fill: p ? '#' + p[1].slice(2).toLowerCase() : '', width: w ? F(w[1]) : 1, multimer: h ? +/>(\d+)</.exec(t.slice(h[0], h[1]))[1] > 1 : false, cls: A.cls, font: fz ? F(fz[1]) : 12 };   // its name's size, CellDesigner's 12 where absent
  }
  // the fill (#rrggbb, written opaque) and the border width of one species alias, in its usual view (the brief view kept), and its font size
  function restyle(t, id, o) {
    var C = alias(t, id);
    if (C.kind === 'compartmentAlias') {   // its colour (CellDesigner's paint, the band and the lines drawn from it) and its double line
      if (o.width != null) refuse('A compartment keeps its two lines.');
      if (o.mem != null || o.outer != null || o.inner != null) {   // CellDesigner's limits: thickness 2 at least, inner above 0, outer at least inner + 1
        var L = look(t, id), mem = o.mem != null ? o.mem : L.mem, ow = o.outer != null ? o.outer : L.outer, iw = o.inner != null ? o.inner : L.inner;
        if (!(mem >= 2)) refuse('A membrane is 2 thick at least.');
        if (!(iw > 0) || !(ow >= iw + 1)) refuse('The outer line is at least the inner line + 1.');
        var pl0 = namePlace(t, id, true), ds = span(t, '<celldesigner:doubleLine', C.sp[0], C.sp[1]), kv = [['thickness', num(mem)], ['outerWidth', num(ow)], ['innerWidth', num(iw)]];
        if (ds) t = attrs(t, ds[0], kv);
        else {   // none written: one after the namePoint (else the bounds), as CellDesigner orders them
          var bs = span(t, '<celldesigner:namePoint ', C.sp[0], C.sp[1]) || span(t, '<celldesigner:bounds ', C.sp[0], C.sp[1]);
          if (!bs) fail('No bounds on ' + id + '.');
          var e = t.indexOf('>', bs[0]) + 1;
          t = put(t, e, e, '\n<celldesigner:doubleLine ' + kv.map(function (q) { return q[0] + '="' + q[1] + '"'; }).join(' ') + '/>');
        }
        if (pl0) t = nameAt(t, id, pl0);   // a name at one of the nine places follows the membrane
        C = alias(t, id);
      }
      if (o.fill == null) return t;
      if (!/^#[0-9a-fA-F]{6}$/.test(o.fill)) fail('A fill is a colour #rrggbb.');
      var cs = span(t, '<celldesigner:paint ', C.sp[0], C.sp[1]);
      if (!cs) fail('No colour on ' + id + '.');
      return attrs(t, cs[0], [['color', 'ff' + o.fill.slice(1).toLowerCase()]]);
    }
    var A = entity(t, id);
    if (A.cls === 'DEGRADED' && o.fill != null) refuse('A degraded species keeps CellDesigner\u2019s look.');
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
      if (!(o.width > 0 && o.width <= 20)) refuse('A border width is above 0 and 20 at most.');
      set('<celldesigner:singleLine ', 'width', num(o.width));
    }
    if (o.font != null) {   // the name's size: the alias's font (CellDesigner keeps no font family), one after the bounds where none is written
      if (!(o.font >= 1 && o.font <= 200)) refuse('A font size is 1 to 200.');
      var z = String(Math.round(o.font));   // a whole number, as CellDesigner writes and reads it
      var B = alias(t, id), fs = span(t, '<celldesigner:font ', B.sp[0], B.sp[1]);
      if (fs) t = attrs(t, fs[0], [['size', z]]);
      else {
        var bs = span(t, '<celldesigner:bounds ', B.sp[0], B.sp[1]);
        if (!bs) fail('No bounds on ' + id + '.');
        var e = t.indexOf('>', bs[0]) + 1;
        t = put(t, e, e, '\n<celldesigner:font size="' + z + '"/>');
      }
    }
    return t;
  }
  // every species and compartment alias recoloured in one pass (a whole map): fn(cls, id) gives its fill (#rrggbb, written
  // opaque) or null to leave it; cls 'COMPARTMENT' for a compartment; a degraded species keeps CellDesigner's look. Only the
  // paint of the usual view (a compartment's own paint) changes. lineFn(k, rid, key), when given, the colour of the k-th line
  // of the reactions in file order (each celldesigner:line: a main line, an added reactant's or product's, a modifier's; not
  // a gate's), key its place in reaction rid (lineKey). A colour is #rrggbb (written opaque) or CellDesigner's eight digits
  // (aarrggbb, as colours() gives them), written as they are
  function recolourAll(t, fn, lineFn) {
    var kind = {}, put = [], m, re = /<(species|celldesigner:species)(?=\s)[^>]*\sid="([^"]+)"[\s\S]*?<\/\1>/g;
    while ((m = re.exec(t))) { var c = /<celldesigner:class>([^<]*)</.exec(m[0]); if (c) kind[m[2]] = c[1]; }
    re = /<celldesigner:(speciesAlias|complexSpeciesAlias|compartmentAlias)(?=\s)([^>]*)>[\s\S]*?<\/celldesigner:\1>/g;
    while ((m = re.exec(t))) {
      var id = at(m[0], 'id'), comp = m[1] === 'compartmentAlias', cls = comp ? 'COMPARTMENT' : kind[at(m[0], 'species')];
      if (!cls || cls === 'DEGRADED') continue;
      var col = fn(cls, id);
      if (!col) continue;
      if (!/^(#[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(col)) fail('A fill is a colour #rrggbb.');
      var p = comp ? /<celldesigner:paint color="[0-9a-fA-F]{8}"/.exec(m[0]) : /<celldesigner:usualView>[\s\S]*?(<celldesigner:paint color="[0-9a-fA-F]{8}")/.exec(m[0]);
      if (!p) continue;
      var off = comp ? p.index : p.index + p[0].length - p[1].length, i = m.index + off + '<celldesigner:paint color="'.length;
      put.push([i, col.length === 8 ? col : 'ff' + col.slice(1).toLowerCase()]);
    }
    if (lineFn) {
      var lists = [], k = 0, rl = /<reaction(?=\s)[\s\S]*?<\/reaction>/g, r;
      while ((r = rl.exec(t))) lists.push([r.index, r[0]]);
      lists.forEach(function (R) {   // a logic gate's lines left out: drawn in their reaction's colour (lineAt)
        var P = null, skip = [];
        try { P = parts(t, at(R[1], 'id')); } catch (e) {}   // a reaction parts() cannot read: none left out
        if (P) { skip = P.gm.map(function (g) { return g.sp; }); P.mods.forEach(function (m, n) { if (isGate(m) || owner(P, n) !== null) skip.push(m.sp); }); }
        var lr = /<celldesigner:line(?=\s[^>]*\bcolor=")[^>]*?\bcolor="([0-9a-fA-F]{8})"/g, L, rid = at(R[1], 'id'), key = lineKey(R[1]);
        while ((L = lr.exec(R[1]))) {
          var pos = R[0] + L.index, kk = key(L.index);
          if (skip.some(function (q) { return pos >= q[0] && pos < q[1]; })) continue;
          var c2 = lineFn(k++, rid, kk);
          if (!c2) continue;
          if (!/^(#[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c2)) fail('A line colour is a colour #rrggbb.');
          put.push([R[0] + L.index + L[0].length - 9, c2.length === 8 ? c2 : 'ff' + c2.slice(1).toLowerCase()]);
        }
      });
    }
    put.sort(function (a, b) { return b[0] - a[0]; });
    put.forEach(function (q) { t = t.slice(0, q[0]) + q[1] + t.slice(q[0] + 8); });
    return t;
  }
  // the place of each line in a reaction's text, from its offset: 'r:<alias>' an added reactant's, 'p:<alias>' an added
  // product's, 'm:<type>:<aliases>' a modifier's, 'main' the reaction's own; '#n' after a place met again. A place does not
  // shift when another line is added or taken out
  function lineKey(rt) {
    var sp = [], m, re = /<celldesigner:(reactantLink|productLink|modification)(?=\s)([^>]*)>[\s\S]*?<\/celldesigner:\1>/g, seen = {};
    while ((m = re.exec(rt))) sp.push([m.index, m.index + m[0].length, m[1] === 'modification' ? 'm:' + at(m[0], 'type') + ':' + at(m[0], 'aliases') : (m[1] === 'reactantLink' ? 'r:' : 'p:') + at(m[0], 'alias')]);
    return function (i) {
      var q = sp.filter(function (s2) { return i >= s2[0] && i < s2[1]; })[0], k = q ? q[2] : 'main';
      seen[k] = (seen[k] || 0) + 1;
      return seen[k] > 1 ? k + '#' + seen[k] : k;
    };
  }
  // every alias's fill and every reaction's line colours as written (CellDesigner's eight digits, aarrggbb), in one pass:
  // { fill: { alias: c }, line: { reaction: { place: c } } } (lineKey); a degraded species left out, as recolourAll leaves it
  function colours(t) {
    var kind = {}, o = { fill: {}, line: {} }, m, re = /<(species|celldesigner:species)(?=\s)[^>]*\sid="([^"]+)"[\s\S]*?<\/\1>/g;
    while ((m = re.exec(t))) { var c = /<celldesigner:class>([^<]*)</.exec(m[0]); if (c) kind[m[2]] = c[1]; }
    re = /<celldesigner:(speciesAlias|complexSpeciesAlias|compartmentAlias)(?=\s)([^>]*)>[\s\S]*?<\/celldesigner:\1>/g;
    while ((m = re.exec(t))) {
      var comp = m[1] === 'compartmentAlias';
      if (!comp && (kind[at(m[0], 'species')] || 'DEGRADED') === 'DEGRADED') continue;
      var p = comp ? /<celldesigner:paint color="([0-9a-fA-F]{8})"/.exec(m[0]) : /<celldesigner:usualView>[\s\S]*?<celldesigner:paint color="([0-9a-fA-F]{8})"/.exec(m[0]);
      if (p) o.fill[at(m[0], 'id')] = p[1];
    }
    var rl = /<reaction(?=\s)[\s\S]*?<\/reaction>/g, r, L;
    while ((r = rl.exec(t))) {
      var lr = /<celldesigner:line(?=\s[^>]*\bcolor=")[^>]*?\bcolor="([0-9a-fA-F]{8})"/g, cs = {}, n = 0, key = lineKey(r[0]);
      while ((L = lr.exec(r[0]))) { cs[key(L.index)] = L[1]; n++; }
      if (n) o.line[at(r[0], 'id')] = cs;
    }
    return o;
  }
  // a line's colour (#rrggbb): a modifier's (rid|mN), an added reactant's or product's (rid|rN, rid|pN) its own line, as
  // CellDesigner keeps one for each; else its reaction's (its main line, a reduced notation's line). A logic gate's lines,
  // its inputs included, are drawn in the reaction's colour: none of their own (null from lineColour)
  function lineAt(t, eid) {
    var m = /^(.*)\|(a|b|i\d+|m\d+|r\d+|p\d+)$/.exec(eid);
    if (!m) return null;
    var R = parts(t, m[1]), k = m[2][0], n = +m[2].slice(1), own = k === 'm' ? R.mods[n] : k === 'r' ? R.rl[n] : k === 'p' ? R.pl[n] : null;
    if ((k === 'r' || k === 'p') && !own) return null;
    if (k === 'm' && (!own || isGate(own) || owner(R, n) !== null)) return null;
    if (own) return span(t, '<celldesigner:line ', own.sp[0], own.sp[1]);
    var skip = ['listOfModification', 'listOfReactantLinks', 'listOfProductLinks', 'listOfGateMember'].map(function (l) { return span(t, '<celldesigner:' + l + '>', R.x[0], R.x[1]); }).filter(Boolean);
    return all(t, '<celldesigner:line ', R.x).map(function (L) { return L.sp; }).filter(function (L) { return !skip.some(function (q) { return L[0] >= q[0] && L[0] < q[1]; }); })[0] || null;
  }
  function lineColour(t, eid) { var L = lineAt(t, eid), c = L && at(head(t, L), 'color'); return L ? '#' + (c && /^[0-9a-fA-F]{8}$/.test(c) ? c.slice(2).toLowerCase() : '000000') : null; }
  function recolourLine(t, eid, c) {   // c #rrggbb, written opaque
    if (!/^#[0-9a-fA-F]{6}$/.test(c || '')) fail('A line colour is a colour #rrggbb.');
    var L = lineAt(t, eid), col = 'ff' + c.slice(1).toLowerCase();
    if (!L) refuse('A logic gate\u2019s lines take their reaction\u2019s colour.');
    return attrs(t, L[0], [['color', col]]);   // that line alone: the reaction's leaves its added reactants and products their own
  }
  // a reactant's or product's number (SBGN's cardinality), the stoichiometry of its speciesReference in the reaction's
  // SBML lists, by the line's id: rid|a the main reactant, rid|b the main product, rid|rN, rid|pN an added one; written
  // only when it is not 1, as CellDesigner writes it (null: a line that has none)
  function stoichRef(t, eid) {
    var m = /^(.*)\|(a|b|r\d+|p\d+)$/.exec(eid || ''), R;
    if (!m) return null;
    try { R = parts(t, m[1]); } catch (e) { return null; }
    if (FULL.indexOf(R.type) < 0 || R.br.length !== 1 || R.bp.length !== 1) return null;
    var k = m[2][0], P = k === 'a' ? R.br[0] : k === 'b' ? R.bp[0] : (k === 'r' ? R.rl : R.pl)[+m[2].slice(1)];
    var lst = P && span(t, k === 'a' || k === 'r' ? '<listOfReactants>' : '<listOfProducts>', R.rs[0], R.rs[1]), al = P && at(P.tag, 'alias');
    return (lst && all(t, '<speciesReference[\\s>/]', lst).filter(function (r) { return t.slice(r.sp[0], r.sp[1]).indexOf('<celldesigner:alias>' + al + '</celldesigner:alias>') >= 0; })[0]) || null;
  }
  function stoichiometry(t, eid) {   // '' for 1, the number as written otherwise; undefined for a line that has none
    var r = stoichRef(t, eid), v = r && at(r.tag, 'stoichiometry'), n = Number(v);
    return !r ? undefined : v == null || n === 1 ? '' : isFinite(n) ? String(n) : v;   // as cdrender draws it (2.50: 2.5)
  }
  function participants(t, rid) {   // a reaction's reactants then products, each { line, name, value } (stoichiometry's line ids), [] where it has none
    var R; try { R = parts(t, rid); } catch (e) { return []; }
    if (FULL.indexOf(R.type) < 0 || R.br.length !== 1 || R.bp.length !== 1) return [];
    var one = function (line, P) { var al = at(P.tag, 'alias'), A; try { A = aliasInfo(t, al); } catch (e) { A = null; } return { line: line, name: A && A.name ? cdr.plainName(A.name) : al, value: stoichiometry(t, line) }; };
    return [one(rid + '|a', R.br[0])].concat(R.rl.map(function (P, n) { return one(rid + '|r' + n, P); }), [one(rid + '|b', R.bp[0])], R.pl.map(function (P, n) { return one(rid + '|p' + n, P); }))
      .filter(function (p) { return p.value !== undefined; });
  }
  function restoich(t, eid, v) {   // v a number above 0 ('' or 1: none written)
    var r = stoichRef(t, eid), n = v === '' || v == null ? 1 : Number(v);
    if (!r) refuse('Only a reactant\u2019s or product\u2019s line has a cardinality.');
    if (!(n > 0) || !isFinite(n)) fail('A cardinality is a number above 0.');
    if (stoichiometry(t, eid) === (n === 1 ? '' : String(n))) return t;
    return attrs(t, r.sp[0], [['stoichiometry', n === 1 ? null : String(n)]]);
  }
  function lineWidth(t, eid) { var L = lineAt(t, eid), w = L && parseFloat(at(head(t, L), 'width')); return L ? (w > 0 ? w : 1) : null; }   // the same line as lineColour's
  function rewidthLine(t, eid, w) {   // w a number, written as CellDesigner writes it (1.0)
    if (!(w > 0)) fail('A line width is a number above 0.');
    var L = lineAt(t, eid);
    if (!L) refuse('A logic gate\u2019s lines take their reaction\u2019s width.');
    if (lineWidth(t, eid) === w) return t;   // the same number as the file writes it (1 for 1.0): no change
    return attrs(t, L[0], [['width', String(w % 1 ? w : w.toFixed(1))]]);
  }
  // ---- MINERVA's pictures ----
  // A picture is the line 'Glyph: glyphs/x.png' in an element's notes, as MINERVA reads it: a compartment's or a top-level
  // species' SBML notes (a complex's too; its members' are not read), and a layer text's layerNotes (a background).
  // MINERVA may write 'Z-Index: n' and 'SemanticZoomLevelTransparency: n' beside it. Written as MINERVA's own projects and
  // the packer of the collections write it: the line first in the notes' body, the rest of the notes kept; CellDesigner
  // shows the lines as text and draws nothing. Removed, the Glyph line goes with MINERVA's lines right after it and the rest stays; notes made here for the
  // picture alone go with it, so a picture put on and taken off gives the text back
  var BG_LAYER = 'Background images', BG_NAME = 'Background (?:images|pictures)';   // written; read (the earlier name too)
  var GLYPH = /Glyph:[ \t]*([^\r\n<]+?\.(?:png|svg))[ \t\r]*(?:\n|<|$)/i;
  var NOTES0 = '<notes>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head>\n<title/>\n</head>\n<body>';
  var NOTES1 = '</body>\n</html>\n</notes>';
  function picClean(s) { return s.replace(/(^|>)[ \t]*Glyph:[^\r\n<]*(?:\r?\n|(?=<)|$)(?:[ \t]*(?:Z-Index|SemanticZoomLevelTransparency):[^\r\n<]*(?:\r?\n|(?=<)|$))*/gim, '$1'); }   // the Glyph line (also the first after <body>) and MINERVA's lines right after it; a Z-Index of the element's own, elsewhere, kept
  function picOwner(t, id) {   // the model element whose notes hold a node's picture: its span
    var A = alias(t, id);
    if (A.kind === 'compartmentAlias') {
      var c = span(t, '<compartment(?=\\s)[^>]*\\sid="' + q(A.compartment) + '"');
      if (!c) fail('No compartment ' + A.compartment + ' on the map.');
      return c;
    }
    if (A.s.inc) refuse('A member of a complex takes no picture; its complex does.');
    return A.s.sp;
  }
  function notesIn(t, sp) {   // the element's own notes, before or after its annotation (not inside it): [start, end] in t, or null
    var h = t.indexOf('>', sp[0]) + 1, an = span(t, '<annotation[\\s>]', h, sp[1]), n = t.indexOf('<notes>', h);
    if (n >= 0 && an && n > an[0] && n < an[1]) n = t.indexOf('<notes>', an[1]);
    return n >= 0 && n < sp[1] ? [n, t.indexOf('</notes>', n) + 8] : null;
  }
  function pictureOf(t, id) { var n = notesIn(t, picOwner(t, id)), m = n && GLYPH.exec(t.slice(n[0], n[1])); return m ? unesc(m[1]) : null; }
  function picture(t, id, name) {   // name 'glyphs/x.png' put on (or in place of the one there), null taken off
    var sp = picOwner(t, id), n = notesIn(t, sp), line = name ? 'Glyph: ' + py.escape(name) + '\n' : '';
    if (name && !/^glyphs\/[^/]+\.png$/.test(name)) fail('A picture is named glyphs/<name>.png.');
    if (!n) {
      if (!name) return t;
      if (t.slice(sp[1] - 2, sp[1]) === '/>' && t.indexOf('>', sp[0]) + 1 === sp[1]) {   // <compartment .../> with nothing inside
        var tag = head(t, sp).slice(0, -2) + '>', nm = /^<(\w+)/.exec(tag)[1];
        return put(t, sp[0], sp[1], tag + '\n' + NOTES0 + line + NOTES1 + '\n</' + nm + '>');
      }
      var h = eol(t, t.indexOf('>', sp[0]) + 1);
      return put(t, h, h, NOTES0 + line + NOTES1 + '\n');
    }
    var seg = t.slice(n[0], n[1]), g = GLYPH.exec(seg);
    if (g && name) {   // replaced: the name alone, its other lines kept
      var a = n[0] + g.index + g[0].indexOf(g[1]);
      return unesc(g[1]) === name ? t : put(t, a, a + g[1].length, py.escape(name));
    }
    var b = /(<(?:\w+:)?body\b[^>]*?)(\/?)>/.exec(seg);
    if (!name) {
      if (!g) return t;
      var s2 = picClean(seg), b2 = /(<(?:\w+:)?body\b[^>]*>)([\s\S]*?)(<\/(?:\w+:)?body>)/.exec(s2);
      if (b2 && !b2[2]) s2 = s2.slice(0, b2.index) + b2[1].slice(0, -1) + '/>' + s2.slice(b2.index + b2[0].length);   // a body left empty written as CellDesigner writes one
      var s2n = s2.replace(/\r\n/g, '\n');   // the file's own line ends (put() wrote CRLF in a CRLF file)
      if (s2n === NOTES0 + NOTES1 || s2n === NOTES0.replace('<body>', '<body/>') + NOTES1.replace('</body>', '')) return cut(t, n);   // notes made for the picture alone
      return put(t, n[0], n[1], s2);
    }
    if (b && b[2]) return put(t, n[0] + b.index, n[0] + b.index + b[0].length, b[1] + '>' + line + '</' + /^<([\w:]+)/.exec(b[1])[1] + '>');   // <body/>
    if (b) { var at0 = n[0] + b.index + b[0].length, own = /^(?:[ \t]*(?:Z-Index|SemanticZoomLevelTransparency):[^\r\n<]*\r?\n)*/.exec(t.slice(at0))[0]; at0 += own.length; return put(t, at0, at0, line); }   // after MINERVA lines the element has of its own, so taking the picture off leaves them
    return put(t, n[1] - 8, n[1] - 8, NOTES0.slice(8) + line + NOTES1.slice(0, -8));   // notes with no body: a body of its own after what is there
  }
  // backgrounds: the layer texts whose notes name a picture, in the file's order: [{ n, name, box }]; n counts every
  // layer text of the file, so a background keeps its number while others are added after it
  function layerTexts(t) { return all(t, '<celldesigner:layerSpeciesAlias(?=[\\s>])', [0, t.length]); }
  function backgrounds(t) {
    return layerTexts(t).map(function (x, k) {
      var seg = t.slice(x.sp[0], x.sp[1]), ln = /<celldesigner:layerNotes>([\s\S]*?)<\/celldesigner:layerNotes>/.exec(seg), m = ln && GLYPH.exec(ln[1]);
      var b = /<celldesigner:bounds [^>]*>/.exec(seg);
      return m ? { n: k, name: unesc(m[1]), box: b ? ['x', 'y', 'w', 'h'].map(function (v) { return F(at(b[0], v)); }) : null } : null;
    }).filter(Boolean);
  }
  function bgText(t, n) { var x = layerTexts(t)[n]; if (!x || !backgrounds(t).some(function (g) { return g.n === n; })) fail('No background image ' + n + ' on the map.'); return x; }
  // a background added: a text of the layer Background images (made visible when the map has none, as MINERVA hides a
  // layer marked not visible and every picture on it; CellDesigner then shows the note's words in the text's box; a name of its own, so a reader's own layer, Background or any, is never written into or
  // removed), its notes the picture under everything (Z-Index -1, as MINERVA's backgrounds), its box the given one.
  // { text, n }
  function background(t, name, box) {
    if (!/^glyphs\/[^/]+\.png$/.test(name || '')) fail('A picture is named glyphs/<name>.png.');
    var B = box.map(num), item = '<celldesigner:layerSpeciesAlias x="' + B[0] + '" y="' + B[1] + '">\n<celldesigner:layerNotes>\nGlyph: ' + py.escape(name) + '\nZ-Index: -1\n</celldesigner:layerNotes>\n' +
      '<celldesigner:bounds x="' + B[0] + '" y="' + B[1] + '" w="' + B[2] + '" h="' + B[3] + '"/>\n<celldesigner:paint color="ff000000"/>\n<celldesigner:font size="11"/>\n</celldesigner:layerSpeciesAlias>';
    var L = span(t, '<celldesigner:layer(?=\\s)[^>]*\\sname="' + BG_NAME + '"'), n = layerTexts(t).length;
    if (L) {
      n = layerTexts(t).filter(function (x) { return x.sp[0] < L[1]; }).length;
      var h = t.indexOf('>', L[0]) + 1;
      if (t[h - 2] === '/') return { text: put(t, L[0], L[1], head(t, L).slice(0, -2) + '>\n<celldesigner:listOfTexts>\n' + item + '\n</celldesigner:listOfTexts>\n</celldesigner:layer>'), n: n };   // <layer .../>
      return { text: add(t, CD + 'listOfTexts', item, L[0], L[1], eol(t, h)), n: n };
    }
    var ids_ = ids(t, '<celldesigner:layer(?=\\s)').map(Number).filter(isFinite), lid = (ids_.length ? Math.max.apply(null, ids_) : 0) + 1;
    var layer = '<celldesigner:layer id="' + lid + '" name="' + BG_LAYER + '" locked="false" visible="true">\n<celldesigner:listOfTexts>\n' + item + '\n</celldesigner:listOfTexts>\n</celldesigner:layer>';
    var bd = t.indexOf('<celldesigner:listOfBlockDiagrams'), e = extEnd(t);
    return { text: add(t, CD + 'listOfLayers', layer, 0, t.length, bd >= 0 ? bd : e), n: n };
  }
  // a background changed: o.name its picture, o.box its box (the layer text's x and y with it)
  function backgroundSet(t, n, o) {
    var x = bgText(t, n), seg = t.slice(x.sp[0], x.sp[1]);
    if (o.name) {
      if (!/^glyphs\/[^/]+\.png$/.test(o.name)) fail('A picture is named glyphs/<name>.png.');
      var g = GLYPH.exec(seg.slice(seg.indexOf('<celldesigner:layerNotes>'))), a = x.sp[0] + seg.indexOf('<celldesigner:layerNotes>') + g.index + g[0].indexOf(g[1]);
      if (unesc(g[1]) !== o.name) { t = put(t, a, a + g[1].length, py.escape(o.name)); x = layerTexts(t)[n]; seg = t.slice(x.sp[0], x.sp[1]); }
    }
    if (o.box) {
      var B = o.box.map(num), bm = /<celldesigner:bounds [^>]*>/.exec(seg);
      if (bm) t = attrs(t, x.sp[0] + bm.index, [['x', B[0]], ['y', B[1]], ['w', B[2]], ['h', B[3]]]);
      t = attrs(t, x.sp[0], [['x', B[0]], ['y', B[1]]]);
    }
    return t;
  }
  // a background taken off; the layer Background images left with no text goes too, and the list of layers then as the file
  // writes it empty, so a background added and removed gives the text back
  function backgroundRemove(t, n) {
    var x = bgText(t, n), L0 = span(t, '<celldesigner:layer(?=\\s)[^>]*\\sname="' + BG_NAME + '"');
    t = cut(t, x.sp);
    if (L0 && L0[0] < x.sp[0] && L0[1] > x.sp[1]) {
      var L = span(t, '<celldesigner:layer(?=\\s)[^>]*\\sname="' + BG_NAME + '"'), inner = t.slice(t.indexOf('>', L[0]) + 1, L[1] - '</celldesigner:layer>'.length);
      if (/^\s*<celldesigner:listOfTexts>\s*<\/celldesigner:listOfTexts>\s*$/.test(inner)) { var c0 = cut(t, L); t = /<celldesigner:listOfLayers><\/celldesigner:listOfLayers>/.test(c0) ? c0 : drop(t, L, [CD + 'listOfLayers']); }   // a list written open with nothing in it stays so
    }
    return t;
  }
  // ---- an item's own links, in its RDF as CellDesigner writes it: a reaction's references (PubMed, DOI), the
  // identifiers of a species, a complex's member or a compartment (UniProt, HGNC, ChEBI, GO, MeSH) ----
  // refs(t, rid) -> [{ q, link, key }]: every link of the reaction's own RDF description in the file's order, q its
  // qualifier as written (bqbiol:isDescribedBy, bqmodel:isDescribedBy, bqbiol:is, ...), link the rdf:resource, key the
  // link as db:id decoded (pubmed:19461003, doi:10.1038/nature08124, chebi:CHEBI:15346; an identifiers.org link too),
  // null for any other.
  // setRefs(t, rid, add, del) -> t with the links whose key is in del taken out of the reaction's bqbiol:isDescribedBy
  // bags (whatever their encoding; a qualifier left empty goes, the RDF with it when nothing else is left in it) and the
  // keys of add written at the end of its first bqbiol:isDescribedBy bag (urn:miriam:pubmed:N, urn:miriam:doi: with the
  // DOI encoded as CellDesigner does, its slash %2F), made where missing as CellDesigner 4.4.2 saves one (one bag per
  // qualifier, flush left, its RDF header after celldesigner:extension). A DOI's key compares without case. A link
  // under another qualifier is never touched; the rest byte for byte.
  // idsOf(t, alias) -> { cls, links }: the same for the item an alias stands for (its species, a complex's member's own,
  // or its compartment; cls its class, COMPARTMENT for one); setIds(t, alias, add, del) as setRefs under bqbiol:is,
  // written with CellDesigner's namespaces (urn:miriam:uniprot:Q15831, urn:miriam:hgnc:11389,
  // urn:miriam:obo.chebi:CHEBI%3A15346, urn:miriam:obo.go:GO%3A0016573, urn:miriam:mesh:D012345). A complex's member
  // keeps its RDF in its celldesigner:notes, as CellDesigner does, the notes made where missing and taken out again when
  // nothing else is left in them.
  var RDF_HEAD = '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:vCard="http://www.w3.org/2001/vcard-rdf/3.0#" xmlns:bqbiol="http://biomodels.net/biology-qualifiers/" xmlns:bqmodel="http://biomodels.net/model-qualifiers/">';
  var NOTES_A = '<celldesigner:notes><html xmlns="http://www.w3.org/1999/xhtml"><head><title/></head><body>', NOTES_B = '</body></html></celldesigner:notes>';
  function ownRdf(t, sp, inc) {   // an item's span, its annotation's (a reaction's before its lists; a complex's member's: its notes) and its RDF description's, each null where missing
    var lists = inc ? -1 : t.slice(sp[0], sp[1]).search(/<listOf/), an = span(t, inc ? '<celldesigner:notes[\\s>]' : '<annotation[\\s>]', sp[0], lists < 0 ? sp[1] : sp[0] + lists);
    if (an && lists >= 0 && an[1] > sp[0] + lists) an = null;
    var rdf = an && span(t, '<rdf:RDF[\\s>]', an[0], an[1]);
    return { rs: sp, inc: inc, an: an, rdf: rdf, d: rdf && span(t, '<rdf:Description[\\s>]', rdf[0], rdf[1]) };
  }
  function rxRdf(t, rid) { return ownRdf(t, rspan(t, rid), false); }
  function itemRdf(t, id) {   // the item an alias stands for: its species (a complex's member: its own), or its compartment
    var A = alias(t, id);
    if (A.species) return ownRdf(t, A.s.sp, A.s.inc);
    var C = A.compartment && span(t, '<compartment(?=\\s)[^>]*\\sid="' + q(A.compartment) + '"');
    if (!C) fail('No compartment of ' + id + ' on the map.');
    return ownRdf(t, C, false);
  }
  var ID_NS = { uniprot: 'uniprot', hgnc: 'hgnc', chebi: 'obo.chebi', go: 'obo.go', mesh: 'mesh' };
  function refKey(link) {   // db:id, CellDesigner's obo. namespaces as identifiers.org names them, ChEBI's and GO's prefix kept in the id, HGNC's not
    var m = /^urn:miriam:([\w.]+):(.+)$/.exec(link) || /^https?:\/\/identifiers\.org\/(?:([\w.]+)\/|([\w.]+):)(.+)$/i.exec(link);
    if (!m) return null;
    var db = (m.length > 3 ? m[1] || m[2] : m[1]).toLowerCase(), v = m.length > 3 ? m[3] : m[2];
    try { v = decodeURIComponent(v); } catch (e) {}
    db = db.replace(/^obo\.(chebi|go)$/, '$1');
    if (db === 'chebi' || db === 'go') v = db.toUpperCase() + ':' + v.replace(/^(chebi|go):/i, '');
    else if (db === 'hgnc') v = v.replace(/^hgnc:/i, '');
    else if (db === 'uniprot' || db === 'mesh') v = v.toUpperCase();
    return db + ':' + v;
  }
  function sameKey(a, b) { return a === b || (/^doi:/.test(a) && a.toLowerCase() === String(b).toLowerCase()); }
  function linksOf(t, R) {
    var out = [];
    if (!R.d) return out;
    var body = t.slice(R.d[0], R.d[1]), re = /<((bqbiol|bqmodel):\w+)[\s>][\s\S]*?<\/\1>/g, m;
    while ((m = re.exec(body))) {
      var li = /<rdf:li\s[^>]*rdf:resource="([^"]*)"/g, x;
      while ((x = li.exec(m[0]))) { var link = x[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'); out.push({ q: m[1], link: link, key: refKey(link) }); }
    }
    return out;
  }
  function refs(t, rid) { return linksOf(t, rxRdf(t, rid)); }
  function idsOf(t, id) { var A = alias(t, id); return { cls: A.species ? A.cls : 'COMPARTMENT', links: linksOf(t, itemRdf(t, id)) }; }
  function refUrn(k) { var c = k.indexOf(':'), db = k.slice(0, c), v = k.slice(c + 1); return 'urn:miriam:' + db + ':' + (db === 'doi' ? encodeURIComponent(v) : v); }
  function idUrn(k) { var c = k.indexOf(':'), db = k.slice(0, c); if (!ID_NS[db]) fail('No identifier ' + k + '.'); return 'urn:miriam:' + ID_NS[db] + ':' + k.slice(c + 1).replace(/:/g, '%3A'); }
  function setRefs(t, rid, add, del) { return setLinks(t, function (t) { return rxRdf(t, rid); }, 'bqbiol:isDescribedBy', add, del, refUrn); }
  function setIds(t, id, add, del) { return setLinks(t, function (t) { return itemRdf(t, id); }, 'bqbiol:is', add, del, idUrn); }
  function setLinks(t, loc, qual, add, del, urnOf) {   // loc(t): where the item's RDF is (ownRdf), found again after each change
    var own = linksOf(t, loc(t)).filter(function (r) { return r.q === qual && r.key; }), open = '<' + qual + '[\\s>]';
    var gone = own.filter(function (r) { return (del || []).some(function (k) { return sameKey(k, r.key); }); });
    add = (add || []).filter(function (k, j, a) { return a.findIndex(function (x) { return sameKey(x, k); }) === j && !own.some(function (r) { return sameKey(r.key, k) && gone.indexOf(r) < 0; }); });
    if (!add.length && !gone.length) return t;
    var esc = function (u) { return u.replace(/&/g, '&amp;').replace(/"/g, '&quot;'); };
    gone.forEach(function (r) {   // each removed link's rdf:li cut; a qualifier holding only it out, the RDF with it when nothing else is in it
      var R = loc(t), quals = all(t, open, R.d);
      for (var k = 0; k < quals.length; k++) {
        var lis = all(t, '<rdf:li\\s[^>]*rdf:resource="' + q(esc(r.link)) + '"', quals[k].sp);
        if (!lis.length) continue;
        if (all(t, '<rdf:li[\\s>/]', quals[k].sp).length > 1) { t = cut(t, lis[0].sp); return; }
        var inner = t.slice(R.d[0] + head(t, R.d).length, quals[k].sp[0]) + t.slice(quals[k].sp[1], t.lastIndexOf('</rdf:Description>', R.d[1]));
        var top = !/</.test(inner) && all(t, '<rdf:Description[\\s>]', R.rdf).length === 1 ? R.rdf : quals[k].sp;
        t = cut(t, top);
        var R2 = loc(t);   // a complex's member's notes made here for it, nothing else left in them: out again
        if (top === R.rdf && R2.inc && R2.an && t.slice(R2.an[0], R2.an[1]) === NOTES_A + NOTES_B) t = put(t, R2.an[0], R2.an[1], '');
        else if (top === R.rdf && R2.inc && R2.an) { var eb = t.indexOf('<body></body>', R2.an[0]); if (eb >= 0 && eb < R2.an[1]) t = put(t, eb, eb + 13, '<body/>'); }   // an empty body written short again
        return;
      }
    });
    if (!add.length) return t;
    var lines = add.map(function (k) { return '<rdf:li rdf:resource="' + esc(urnOf(k)) + '"/>\n'; }).join('');
    var R = loc(t), bag = R.d && all(t, open, R.d).map(function (x) { return span(t, '<rdf:Bag[\\s>]', x.sp[0], x.sp[1]); }).filter(Boolean)[0];
    if (bag) {
      var e = t.lastIndexOf('</rdf:Bag>', bag[1]), alone = /(^|\n)[ \t]*$/.test(t.slice(Math.max(0, e - 200), e));
      return put(t, e, e, alone ? lines : '\n' + lines);
    }
    var block = '<' + qual + '>\n<rdf:Bag>\n' + lines + '</rdf:Bag>\n</' + qual + '>\n';
    if (R.d) {   // a description of the item: the qualifier after its last one (bqbiol declared on the RDF, else on the element)
      var decl = /xmlns:bqbiol=/.test(head(t, R.rdf)) || /xmlns:bqbiol=/.test(head(t, R.d)) ? '' : ' xmlns:bqbiol="http://biomodels.net/biology-qualifiers/"';
      var end = t.lastIndexOf('</rdf:Description>', R.d[1]);
      return put(t, end, end, block.replace('<' + qual + '>', '<' + qual + decl + '>'));
    }
    var h = head(t, R.rs), meta = at(h, 'metaid') || at(h, 'id'), desc = '<rdf:Description rdf:about="#' + meta + '">\n' + block + '</rdf:Description>\n';
    if (R.rdf) { var re0 = t.lastIndexOf('</rdf:RDF>', R.rdf[1]); return put(t, re0, re0, desc); }
    var rdf = RDF_HEAD + '\n' + desc + '</rdf:RDF>\n';
    if (/\/>$/.test(h)) refuse('This item cannot hold identifiers in the file.');
    var hi = R.rs[0] + h.length;
    if (R.inc) {   // a complex's member: in its notes' body, the notes made where missing (as CellDesigner writes them, right after the member's tag)
      if (!R.an) return put(t, hi, hi, NOTES_A + rdf + NOTES_B);
      var be = t.lastIndexOf('</body>', R.an[1]), bs = t.indexOf('<body/>', R.an[0]);
      if (be < R.an[0] && bs >= 0 && bs < R.an[1]) return put(t, bs, bs + 7, '<body>' + rdf + '</body>');   // an empty body written short
      if (be < R.an[0]) be = t.lastIndexOf('</celldesigner:notes>', R.an[1]);
      return put(t, be, be, rdf);
    }
    if (R.an) { var ae = t.lastIndexOf('</annotation>', R.an[1]); return put(t, ae, ae, rdf); }
    return put(t, hi, eol(t, hi), '\n<annotation>\n' + rdf + '</annotation>\n');
  }
  function aliasInfo(t, id) {
    var A = alias(t, id), C = A.kind === 'compartmentAlias' ? span(t, '<compartment(?=\\s)[^>]*\\sid="' + q(A.compartment) + '"') : null;
    var hd = A.s && /<celldesigner:homodimer>(\d+)</.exec(t.slice(A.s.sp[0], A.s.sp[1]));
    return { kind: A.kind, cls: A.cls || null, id: A.species || A.compartment, name: A.s ? A.s.name : C ? at(head(t, C), 'name') : null, complex: A.complex, box: A.box, homodimer: hd ? +hd[1] : 1 };
  }
  var api = { refs: refs, setRefs: setRefs, idsOf: idsOf, setIds: setIds, picture: picture, pictureOf: pictureOf, backgrounds: backgrounds, background: background, backgroundSet: backgroundSet, backgroundRemove: backgroundRemove, LOOK: LOOK, COMP: COMP, lineColour: lineColour, recolourLine: recolourLine, lineWidth: lineWidth, rewidthLine: rewidthLine, stoichiometry: stoichiometry, restoich: restoich, participants: participants, PROCESS: PROCESS, REDUCED: REDUCED, sbgn: sbgn, MODS: MODS, NEED: NEED, about: about, aliasInfo: aliasInfo, classColour: classColour, compartmentColour: compartmentColour, classColours: classColours, classSize: classSize, empty: empty, species: newSpecies, compartment: compartment, rename: rename, namePlace: namePlace, nameAt: nameAt, nameInfo: nameInfo, retype: retype, remove: remove, reaction: reaction, reduced: reduced,
    reactant: reactant, product: product, modifier: modifier, reactionType: reactionType, reversible: reversible, modifierType: modifierType, removeLine: removeLine,
    gate: gate, gateInput: gateInput, gateInputRemove: gateInputRemove, gateType: gateType, residue: residue, residueState: residueState,
    residueRemove: residueRemove, residueName: residueName, residueMove: residueMove, structuralMove: structuralMove, features: features, STATES: STATES, placesFor: placesFor, ratioAngle: ratioAngle, bounds: bounds, proteinAliases: proteinAliases, joinKin: joinKin, structural: structural, info: info, infoUnit: infoUnit, INFO: INFO, homodimer: homodimer, look: look, restyle: restyle, recolourAll: recolourAll, colours: colours, cdName: cdName, joinable: joinable, join: join, leave: leave };
  Object.keys(api).forEach(function (k) {   // a file in CellDesigner 4.0's layout written back in it (older, bare)
    var f = api[k];
    if (typeof f === 'function' && !/^[A-Z]/.test(k)) api[k] = function (t) { var r = f.apply(this, arguments); return typeof t === 'string' && older(t) ? bare(r) : r; };
  });
  if (node) module.exports = api; else root.cd_make = api;
})(typeof window !== 'undefined' ? window : globalThis);
