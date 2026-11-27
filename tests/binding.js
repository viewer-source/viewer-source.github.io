// Association and dissociation in a file's style (sbgn_edit binding, notes/association-style.md):
//   1. every SBGN-ML file of the test maps written back from the editor's own GraphML of it is unchanged (a file's own
//      glyphs, squares and circles, are never changed);
//   2. the shape rule on small files, one per row of the rule's table (association of two and of a nested complex,
//      a multimer from a cardinality, their mirrors; a state changed, a source, several in and out, a macromolecule
//      made, a complex moved whole, a reversible process, a cardinality of ?: a process; a gene's ct:gene no state);
//      exactly half of the file's binding shapes as circles: not the style; arcs without ids counted each;
//   3. through the editor's own steps (the browser's reading, add, connect, write) on two Newt maps: A + B -> complex
//      made again on two gene system behavior (in association style) is written as an association, nothing else of the
//      file changed; the same on atm mediated phosphorylation (squares only) stays a process.
//   node tests/binding.js [folder holding test-maps/]   (default: viewer/, where the data repository's test-maps are linked)
var fs = require('fs'), path = require('path');
var here = path.join(__dirname, '..'), se = require(path.join(here, 'renderers/converter/sbgn_edit.js'));
var rd = require(path.join(here, 'renderers/converter/sbgnml_read.js'));
var DP = require('@xmldom/xmldom').DOMParser, opt = { DOMParser: DP };
var data = process.argv[2] || here, bad = 0, ok = 0;
var check = function (c, what) { if (c) ok++; else { bad++; console.log('WRONG ' + what); } };
var read = function (f) { return fs.readFileSync(f, 'utf8').replace(/^﻿/, ''); };

// 1
var files = [];
(function walk(p) { var st; try { st = fs.statSync(p); } catch (e) { return; } if (st.isDirectory()) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); else if (/\.(sbgn|nwt)$/.test(p)) files.push(p); })(path.join(data, 'test-maps'));
if (!files.length) { console.log('no test maps under ' + data); process.exit(1); }
files.forEach(function (f) { var t = read(f), g, w; try { g = se.graphml(t, rd.graphml(t, opt).text, opt); } catch (e) { return; }   // refused on opening (the editor never writes it)
  try { w = se.write(t, g, opt); } catch (e) { w = 'error ' + e.message; } check(w === t, 'own file changed: ' + path.relative(data, f) + (w.slice(0, 6) === 'error ' ? ' (' + w + ')' : '')); });

// 2
var ent = function (id, cls, label, states, kids) {
  return '<glyph id="' + id + '" class="' + cls + '"><label text="' + label + '"/><bbox x="0" y="0" w="60" h="40"/>' +
    (states || []).map(function (s, k) { return '<glyph id="' + id + 's' + k + '" class="state variable"><state value="' + s + '" variable="S' + k + '"/><bbox x="0" y="0" w="15" h="15"/></glyph>'; }).join('') + (kids || []).join('') + '</glyph>';
};
var proc = function (id, cls) { return '<glyph id="' + id + '" class="' + (cls || 'process') + '"><bbox x="0" y="0" w="18" h="18"/><port id="' + id + '.1" x="0" y="9"/><port id="' + id + '.2" x="18" y="9"/></glyph>'; };
var arc = function (id, cls, s, t, n) { return '<arc id="' + id + '" class="' + cls + '" source="' + s + '" target="' + t + '"><start x="0" y="0"/><end x="1" y="1"/>' + (n ? '<glyph id="' + id + 'c" class="cardinality"><label text="' + n + '"/><bbox x="0" y="0" w="10" h="10"/></glyph>' : '') + '</arc>'; };
var file = function (body) { return '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3"><map id="m" language="process description">' + body + '</map></sbgn>'; };
// the style: two associations of the file's own (X + Y -> complex), so the file is in association style
var style = ent('x', 'macromolecule', 'X') + ent('y', 'simple chemical', 'Y') + ent('xy', 'complex', '', [], [ent('xy1', 'macromolecule', 'X'), ent('xy2', 'simple chemical', 'Y')]) +
  proc('own1', 'association') + arc('o1', 'consumption', 'x', 'own1.1') + arc('o2', 'consumption', 'y', 'own1.1') + arc('o3', 'production', 'own1.2', 'xy');
var A = ent('a', 'macromolecule', 'A'), B = ent('b', 'macromolecule', 'B'), Ap = ent('ap', 'macromolecule', 'A', ['P']);
var AB = function (id, a) { return ent(id, 'complex', '', [], [a || ent(id + '1', 'macromolecule', 'A'), ent(id + '2', 'macromolecule', 'B')]); };
var cin = function (p, ins) { return ins.map(function (q, k) { return arc(p + 'i' + k, 'consumption', q[0], p + '.1', q[1]); }).join(''); };
var cout = function (p, outs) { return outs.map(function (q, k) { return arc(p + 'o' + k, 'production', p + '.2', q[0], q[1]); }).join(''); };
var CASES = [
  ['A + B -> complex(A, B)', A + B + AB('ab'), [['a'], ['b']], [['ab']], 'association'],
  ['complex(A, B) -> A + B', A + B + AB('ab'), [['ab']], [['a'], ['b']], 'dissociation'],
  ['complex(A, B) + C -> complex(A, B, C), nested opened', A + B + AB('ab') + ent('c', 'simple chemical', 'C') + ent('abc', 'complex', '', [], [ent('abc1', 'macromolecule', 'A'), ent('abc2', 'macromolecule', 'B'), ent('abc3', 'simple chemical', 'C')]), [['ab'], ['c']], [['abc']], 'association'],
  ['4 A -> A multimer', A + ent('a4', 'macromolecule multimer', 'A'), [['a', '4']], [['a4']], 'association'],
  ['A multimer -> 4 A', A + ent('a4', 'macromolecule multimer', 'A'), [['a4']], [['a', '4']], 'dissociation'],
  ['2 A -> complex(A, A)', A + ent('aa', 'complex', '', [], [ent('aa1', 'macromolecule', 'A'), ent('aa2', 'macromolecule', 'A')]), [['a', '2']], [['aa']], 'association'],
  ['A + B -> complex(A-P, B), a state changed', A + B + AB('ab', ent('abp', 'macromolecule', 'A', ['P'])), [['a'], ['b']], [['ab']], null],
  ['A-P + B -> complex(A, B), a state changed', Ap + B + AB('ab'), [['ap'], ['b']], [['ab']], null],
  ['source + B -> complex(A, B)', '<glyph id="e" class="source and sink"><bbox x="0" y="0" w="20" h="20"/></glyph>' + B + AB('ab'), [['e'], ['b']], [['ab']], null],
  ['A + B -> complex(A, B) + B, several in and out', A + B + AB('ab'), [['a'], ['b']], [['ab'], ['b']], null],
  ['A + B -> macromolecule AB', A + B + ent('m', 'macromolecule', 'AB'), [['a'], ['b']], [['m']], null],
  ['complex(A, B) -> complex(A, B), moved whole', AB('ab') + AB('ab2'), [['ab']], [['ab2']], null],
  ['A + C -> complex(A, B), members differ', A + ent('c', 'macromolecule', 'C') + AB('ab'), [['a'], ['c']], [['ab']], null],
  ['A + B -> complex(A, B), reversible', A + B + AB('ab'), [['a'], ['b']], [['ab']], null, true],
  ['? A -> A multimer', A + ent('a4', 'macromolecule multimer', 'A'), [['a', '?']], [['a4']], null],
  ['gene gB (ct:gene) + A -> complex(A, gB)', A + ent('g', 'nucleic acid feature', 'gB', ['ct:gene']).replace('variable="S0"', '') + ent('ag', 'complex', '', [], [ent('ag1', 'macromolecule', 'A'), ent('ag2', 'nucleic acid feature', 'gB')]), [['a'], ['g']], [['ag']], 'association'],
  ['A -> A multimer without a cardinality', A + ent('a4', 'macromolecule multimer', 'A'), [['a']], [['a4']], null]
];
CASES.forEach(function (c) {
  var rev = c[5] ? arc('pr', 'production', 'p.1', c[2][0][0]) : '';
  var t0 = file(style + c[1]), t1 = file(style + c[1] + proc('p') + (c[5] ? '' : cin('p', c[2])) + rev + (c[5] ? cin('p', c[2].slice(1)) : '') + cout('p', c[3])), w = se.binding(t0, t1, opt);
  var cls = (w.match(/<glyph id="p" class="([^"]+)"/) || [])[1];
  check(cls === (c[4] || 'process'), c[0] + ': written as ' + cls + ', expected ' + (c[4] || 'process'));
  check(w.replace(/<glyph id="p" class="[^"]+"/, '') === t1.replace(/<glyph id="p" class="[^"]+"/, ''), c[0] + ': something else changed');
  var plain = file(c[1]), plain1 = file(c[1] + proc('p') + cin('p', c[2]) + rev + cout('p', c[3]));   // the same without the style: a process
  check(se.binding(plain, plain1, opt) === plain1, c[0] + ': written in a file with no association glyph');
});
var mixed = file(style + A + B + AB('ab') + proc('sq') + cin('sq', [['a'], ['b']]) + cout('sq', [['ab']]) + ent('c', 'macromolecule', 'C') + ent('d', 'macromolecule', 'D') +
  ent('cd', 'complex', '', [], [ent('cd1', 'macromolecule', 'C'), ent('cd2', 'macromolecule', 'D')]) + proc('sq2') + cin('sq2', [['c'], ['d']]) + cout('sq2', [['cd']]));
check(se.binding(mixed, mixed.replace('</map>', proc('p') + cin('p', [['a'], ['b']]) + cout('p', [['ab']]) + '</map>'), opt).indexOf('<glyph id="p" class="process"') >= 0, 'one circle against two squares: still a process (not more than half)');

var half = file(style + A + B + AB('ab') + proc('sq') + cin('sq', [['a'], ['b']]) + cout('sq', [['ab']]));
check(se.binding(half, half.replace('</map>', proc('p') + cin('p', [['a'], ['b']]) + cout('p', [['ab']]) + '</map>'), opt).indexOf('<glyph id="p" class="process"') >= 0, 'one circle against one square: still a process (half is not more than half)');
var noIds = file(style.replace(/<arc id="[^"]*"/g, '<arc') + A + B + AB('ab')), noIds1 = noIds.replace('</map>', proc('p') + cin('p', [['a'], ['b']]).replace(/<arc id="[^"]*"/g, '<arc') + cout('p', [['ab']]).replace(/<arc id="[^"]*"/g, '<arc') + '</map>');
check(se.binding(noIds, noIds1, opt).indexOf('<glyph id="p" class="association"') >= 0, 'arcs without ids: the file still read in its style');

// 3
var made = function (f, ins, out) {
  var t = read(f), g0 = rd.graphml(t, opt).text, g = se.graphml(t, g0, opt), find = function (lab, cls) {
    var S = new DP().parseFromString(t, 'application/xml'), all = S.getElementsByTagName('glyph');
    for (var i = 0; i < all.length; i++) { var l = all[i].getElementsByTagName('label')[0]; if (all[i].getAttribute('class') === cls && all[i].parentNode.localName === 'map' && (cls === 'complex' ? out(all[i]) : l && l.getAttribute('text') === lab)) return all[i].getAttribute('id'); }
    return null;
  };
  var ids = ins.map(function (q) { return find(q, 'macromolecule'); }), cx = find('', 'complex');
  g = se.add(g, { id: 'mk_p', cls: 'process', box: [0, 0, 18, 18] }, opt);
  ids.forEach(function (id, k) { g = se.connect(g, 'mk_c' + k, id, 'mk_p', 'consumption', opt); });
  g = se.connect(g, 'mk_o', 'mk_p', cx, 'production', opt);
  return [t, se.write(t, g, opt), ids.concat(cx)];
};
var two = path.join(data, 'test-maps/sbgn-ml/pd/newt-unstable/two_gene_system_behavior.nwt');
var abOnly = function (g) { var m = [].filter.call(g.getElementsByTagName('label'), function (l) { return l.parentNode.parentNode === g; }).map(function (l) { return l.getAttribute('text'); }).sort().join(','); return m === 'A,B'; };
var r = made(two, ['A', 'B'], abOnly);
check(r[2].every(Boolean), 'two gene system behavior: A, B and their complex found');
check(/<glyph[^>]*id="mk_p"[^>]*class="association"|<glyph[^>]*class="association"[^>]*id="mk_p"/.test(r[1]), 'two gene system behavior: the new A + B -> complex written as an association');
var own = function (t) { return (t.match(/<glyph [^>]*>/g) || []).filter(function (x) { return x.indexOf('mk_') < 0; }); };
check(JSON.stringify(own(r[1])) === JSON.stringify(own(r[0])), 'two gene system behavior: a glyph of the file changed (its own square stays a square)');
var atm = path.join(data, 'test-maps/sbgn-ml/pd/newt-unstable/atm_mediated_phosphorylation_of_repair_proteins.nwt');
var t = read(atm), S = new DP().parseFromString(t, 'application/xml'), g0 = rd.graphml(t, opt).text, g = se.graphml(t, g0, opt);
// atm's first binding square, made again: its inputs and its complex
var sq = [].filter.call(S.getElementsByTagName('glyph'), function (x) { return x.getAttribute('class') === 'process' && se.bindingOf(t, x.getAttribute('id'), opt); })[0];
var arcs = [].slice.call(S.getElementsByTagName('arc')), portOf = function (p) { var e = [].filter.call(S.getElementsByTagName('port'), function (q) { return q.getAttribute('id') === p; })[0]; return e ? e.parentNode.getAttribute('id') : p; };
g = se.add(g, { id: 'mk_p', cls: 'process', box: [0, 0, 18, 18] }, opt);
arcs.forEach(function (a, k) {
  if (a.getAttribute('class') === 'consumption' && portOf(a.getAttribute('target')) === sq.getAttribute('id')) g = se.connect(g, 'mk_c' + k, portOf(a.getAttribute('source')), 'mk_p', 'consumption', opt);
  if (a.getAttribute('class') === 'production' && portOf(a.getAttribute('source')) === sq.getAttribute('id')) g = se.connect(g, 'mk_o' + k, 'mk_p', portOf(a.getAttribute('target')), 'production', opt);
});
var w = se.write(t, g, opt);
check(se.bindingOf(w, 'mk_p', opt) === 'association' && /<glyph[^>]*class="process"[^>]*id="mk_p"|<glyph[^>]*id="mk_p"[^>]*class="process"/.test(w), 'atm mediated phosphorylation (squares only): the new binding stays a process');
console.log(bad ? bad + ' WRONG, ' + ok + ' ok' : 'all ok (' + ok + ' checks, ' + files.length + ' files)');
process.exit(bad ? 1 : 0);
