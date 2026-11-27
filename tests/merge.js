// The join of three versions of a map (editor/src/merge.js), under Node, on the demo maps of the three formats: a base,
// mine and theirs made from it by edits in the text (a node moved, renamed, added, deleted), and the result checked
// against what the edits mean: both sides' changes where they touched different items, byte for byte; mine where both
// touched one; a position alone differing is no clash; a reference left without its item, or a file that does not read,
// is broken and gives mine. Also every result read back as XML (@xmldom) with no error.
//   node tests/merge.js <clone of the site's data repository>
var fs = require('fs'), path = require('path');
var data = process.argv[2];
if (!data) { console.log('usage: node tests/merge.js <clone of the data repository>'); process.exit(2); }
var esb = require(require.resolve('esbuild', { paths: [path.join(__dirname, '..')] }));
var src = esb.transformSync(fs.readFileSync(path.join(__dirname, '../editor/src/merge.js'), 'utf8'), { format: 'cjs' }).code;
var M = { exports: {} }; new Function('module', 'exports', src)(M, M.exports);
var merge3 = M.exports.merge3;
var { DOMParser } = require(require.resolve('@xmldom/xmldom', { paths: [path.join(__dirname, '..')] }));
var bad = 0;
function ok(what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); }
function reads(t) { var errs = []; new DOMParser({ onError: function (l, m) { if (l !== 'warning') errs.push(m); } }).parseFromString(t, 'application/xml'); return !errs.length; }

// the element whose id is id: [start, end] in t
function span(t, id) {
  var a = t.indexOf(' id="' + id + '"'); if (a < 0) throw new Error('no ' + id);
  var s = t.lastIndexOf('<', a), tag = /^<([^\s>/]+)/.exec(t.slice(s))[1], gt = t.indexOf('>', s);
  if (t[gt - 1] === '/') return [s, gt + 1];
  var re = new RegExp('<(/?)' + tag.replace(/[.:]/g, '\\$&') + '(?=[\\s>/])[^>]*?(/?)>', 'g'), d = 0, m;
  re.lastIndex = s;
  while ((m = re.exec(t))) { if (m[1]) d--; else if (!m[2]) d++; if (!d) return [s, m.index + m[0].length]; }
  throw new Error('not closed: ' + id);
}
function within(t, id, f) { var p = span(t, id); return t.slice(0, p[0]) + f(t.slice(p[0], p[1])) + t.slice(p[1]); }
var num = function (v) { return String(+v.toFixed(3)); };   // as the join writes a shifted position
function move(t, id, dx) { return within(t, id, function (s) { return s.replace(/(\sx=")(-?[\d.]+)(")/, function (m, a, n, b) { return a + num(parseFloat(n) + dx) + b; }); }); }
// the whole map shifted, as the editor's save writes it when the map's top left corner moved: every x and y of the tags
// that are on the map
function shiftAll(t, tags, dx, dy) {
  return t.replace(/<([^\s/>!?]+)([^>]*)>/g, function (m, tag, rest) {
    if (tags.indexOf(tag) < 0) return m;
    return '<' + tag + rest.replace(/(\s)(x|y)(\s*=\s*")(-?[\d.]+)"/g, function (mm, sp, ax, eq, v) { return sp + ax + eq + num(parseFloat(v) + (ax === 'x' ? dx : dy)) + '"'; }) + '>';
  });
}
function cut(t, id) { var p = span(t, id), k = p[0]; while (k > 0 && /\s/.test(t[k - 1])) k--; return t.slice(0, k) + t.slice(p[1]); }
function after(t, id, piece) { var p = span(t, id); return t.slice(0, p[1]) + piece + t.slice(p[1]); }
function lead(t, id) { var p = span(t, id), k = p[0]; while (k > 0 && /\s/.test(t[k - 1])) k--; return t.slice(k, p[0]); }

function suite(label, t0, f) {
  console.log('# ' + label);
  var A = f.a, B = f.b;
  // 1. different items moved: both, byte for byte
  var o = move(t0, A, 7), th = move(t0, B, 11), r = merge3(t0, o, th);
  ok(label + ': different items moved, both kept, byte for byte', !r.broken && !r.clashes && r.text === move(move(t0, A, 7), B, 11), r.broken || '');
  ok(label + ': the result reads as XML', reads(r.text));
  // 2. the same item moved on both: mine, no clash
  r = merge3(t0, move(t0, A, 7), move(t0, A, 13));
  ok(label + ': the same item moved on both, ours, no clash', !r.broken && !r.clashes && r.moved === 1 && r.text === move(t0, A, 7));
  // 3. mine moves an item, theirs renames it: a clash, mine
  var named = f.rename(t0, A);
  r = merge3(t0, move(t0, A, 7), named);
  ok(label + ': moved here, renamed there: one clash, ours kept', !r.broken && r.clashes === 1 && r.text === move(t0, A, 7), r.broken || r.clashes);
  // 4. mine moves A, theirs renames B: both
  r = merge3(t0, move(t0, A, 7), f.rename(t0, B));
  ok(label + ': moved here, another renamed there: both', !r.broken && !r.clashes && r.text === f.rename(move(t0, A, 7), B));
  // 5. theirs adds an item, mine moves another: both, the new item after the one before it there
  var add = f.add(t0), r5 = merge3(t0, move(t0, A, 7), add);
  ok(label + ': added there, moved here: both, in place', !r5.broken && !r5.clashes && r5.text === f.add(move(t0, A, 7)), r5.broken || '');
  // 6. both add different items
  var add2 = f.add2(t0), r6 = merge3(t0, add2, add);
  ok(label + ': both add an item: both there', !r6.broken && !r6.clashes && r6.text.indexOf(f.newId) >= 0 && r6.text.indexOf(f.newId2) >= 0 && reads(r6.text), r6.broken || '');
  // 7. theirs deletes an item (and what names it), mine moves another
  var del = f.del(t0), r7 = merge3(t0, move(t0, A, 7), del);
  ok(label + ': deleted there, another moved here: both', !r7.broken && !r7.clashes && r7.text === f.del(move(t0, A, 7)), r7.broken || '');
  // 8. mine deletes an item, theirs adds a reference to it: broken, mine whole
  var refd = f.refTo(t0), r8 = merge3(t0, f.del(t0), refd);
  ok(label + ': deleted here, named by a new item there: broken, ours', !!r8.broken && r8.text === f.del(t0), r8.broken || 'not broken');
  // 9. theirs not a file that reads: broken, mine
  var r9 = merge3(t0, move(t0, A, 7), t0.slice(0, t0.length >> 1));
  ok(label + ': theirs cut short: broken, ours', !!r9.broken && r9.text === move(t0, A, 7), r9.broken || '');
  // 10. nothing changed here: theirs; nothing there: mine; the same: either
  ok(label + ': unchanged here, theirs; unchanged there, ours', merge3(t0, t0, th).text === th && merge3(t0, o, t0).text === o && merge3(t0, o, o).text === o);
  // 11. two machines: a large edit (many moves, a rename, an item added) and a small one from the base (one move, on an
  // item the large edit renamed): the large edit kept outside the item both changed, which is the small edit's, in
  // either order of sending
  var big = f.add(f.rename(f.ids.reduce(function (t, id) { return move(t, id, 3); }, t0), B)), small = move(t0, B, 5);
  var x1 = merge3(t0, small, big), x2 = merge3(t0, big, small);
  var want1 = f.add(f.ids.reduce(function (t, id) { return id === B ? t : move(t, id, 3); }, move(t0, B, 5)));
  ok(label + ': two machines, the small edit sent last: the large kept but the shared item, one clash', !x1.broken && x1.clashes === 1 && x1.text === want1, x1.broken || x1.clashes);
  ok(label + ': two machines, the large edit sent last: all of it, one clash', !x2.broken && x2.clashes === 1 && x2.text === big, x2.broken || x2.clashes);
  // 12. the whole map shifted here (the save's frame) with one item moved; renamed and another moved there, on the base's
  // frame: theirs brought into this frame, no clash
  var C = f.ids.filter(function (x) { return x !== A && x !== B; })[0], here = move(shiftAll(t0, f.on, 832, 1472), A, 7), there = move(f.rename(t0, B), C, 5);
  var r12 = merge3(t0, here, there), w12 = move(f.rename(here, B), C, 5);
  ok(label + ': the map shifted here, changes there on the old frame: brought into the new one, no clash', !r12.broken && !r12.clashes && r12.text === w12, r12.broken || r12.clashes);
  // 13. both sides shifted differently (each its own save), each moved another item
  var h13 = move(shiftAll(t0, f.on, 832, 1472), A, 7), t13 = move(shiftAll(t0, f.on, 832, 1456), C, 5), r13 = merge3(t0, h13, t13);
  ok(label + ': both shifted, each its own frame, each moved another item: both moves, in this frame', !r13.broken && !r13.clashes && r13.text === move(h13, C, 5), r13.broken || r13.clashes);
  // 14. one item moved here, none shifted: no frame taken from a single move
  var r14 = merge3(t0, move(t0, A, 40), f.rename(t0, B));
  ok(label + ': a single move is no frame', !r14.broken && r14.text === f.rename(move(t0, A, 40), B));
}

var gml = fs.readFileSync(path.join(data, 'maps/glycolysis-graphml.graphml'), 'utf8');
var gEdge = /<edge id="([^"]+)" source="([^"]+)" target="([^"]+)"/.exec(gml);
var gLeaves = (gml.match(/<node id="[^"]+"/g) || []).map(function (s) { return /id="([^"]+)"/.exec(s)[1]; }).filter(function (id) { var p = span(gml, id), x = gml.slice(p[0], p[1]); return x.indexOf('<graph') < 0 && /<y:NodeLabel[^>]*>[^<]+</.test(x); });
var gD = gEdge[2], gA = gLeaves.filter(function (x) { return x !== gD; })[0], gB = gLeaves.filter(function (x) { return x !== gD && x !== gA; })[0];
var gNode = function (id, t) {   // a copy of A as it is in t, under another id
   var p = span(t, gA); return t.slice(p[0], p[1]).replace('id="' + gA + '"', 'id="' + id + '"'); };
suite('GraphML', gml, {
  on: ['y:Geometry', 'y:Point'], a: gA, b: gB, newId: 'nnew1', newId2: 'nnew2', ids: gLeaves.slice(0, 12).concat([gB]).filter(function (x, i, l) { return x !== gD && l.indexOf(x) === i; }),
  rename: function (t, id) { return within(t, id, function (s) { return s.replace(/(<y:NodeLabel[^>]*>)([^<]*)/, '$1$2 renamed'); }); },
  add: function (t) { return after(t, gA, lead(t, gA) + gNode('nnew1', gml)); },
  add2: function (t) { return after(t, gB, lead(t, gB) + gNode('nnew2', gml)); },
  del: function (t) { var es = (t.match(new RegExp('<edge id="[^"]+" source="[^"]+" target="' + gD.replace(/:/g, '\\:') + '"|<edge id="[^"]+" source="' + gD.replace(/:/g, '\\:') + '"', 'g')) || []).map(function (s) { return /id="([^"]+)"/.exec(s)[1]; }); return es.concat([gD]).reduce(cut, t); },
  refTo: function (t) { return after(t, gEdge[1], lead(t, gEdge[1]) + '<edge id="enew" source="' + gD + '" target="' + gB + '"/>'); }
});

var cd = fs.readFileSync(path.join(data, 'maps/glycolysis-celldesigner.xml'), 'utf8');
var cdAl = (cd.match(/<celldesigner:speciesAlias id="[^"]+" species="[^"]+"/g) || []).map(function (s) { return /id="([^"]+)"/.exec(s)[1]; });
var cdSp = function (al) { return new RegExp('<celldesigner:speciesAlias id="' + al + '" species="([^"]+)"').exec(cd)[1]; };
var cA = cdAl[0], cB = cdAl[1];
// an alias with its species named by no reaction: deleted with its species
var used = cd.slice(cd.indexOf('<listOfReactions')), cD = cdAl.filter(function (al) { return al !== cA && al !== cB && used.indexOf('"' + al + '"') < 0 && used.indexOf('"' + cdSp(al) + '"') < 0 && used.indexOf('>' + cdSp(al) + '<') < 0; })[0];
var cdAlias = function (id, t) { var p = span(t, cA); return t.slice(p[0], p[1]).replace('id="' + cA + '"', 'id="' + id + '"'); };
suite('CellDesigner', cd, {
  on: ['celldesigner:bounds'], a: cA, b: cB, newId: 'sa_new1', newId2: 'sa_new2', ids: cdAl.slice(0, 12).filter(function (x) { return x !== cD; }),
  rename: function (t, al) { return within(t, al, function (s) { return s.replace(/(<celldesigner:paint color=")[^"]*/, '$1ff000000'); }); },   // a colour: a change that is no position
  add: function (t) { return after(t, cA, lead(t, cA) + cdAlias('sa_new1', cd)); },
  add2: function (t) { return after(t, cB, lead(t, cB) + cdAlias('sa_new2', cd)); },
  del: function (t) { return [cD, cdSp(cD)].reduce(cut, t); },
  refTo: function (t) { return after(t, cA, lead(t, cA) + cdAlias('sa_new3', cd).replace(/species="[^"]+"/, 'species="' + cdSp(cD) + '"')); }
});

var sb = fs.readFileSync(path.join(data, 'maps/colour-glycolysis-sbgn.sbgn'), 'utf8');
var sbArc = /<arc[^>]* id="([^"]+)"[^>]*>/.exec(sb), sbSrc = /source="([^"]+)"/.exec(sbArc[0])[1];
var sbG = (sb.match(/<glyph[^>]* id="[^"]+"[^>]*>\s*<label/g) || []).map(function (s) { return /id="([^"]+)"/.exec(s)[1]; });
var esc = function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }, tok = function (x) { return new RegExp('(^|[\\s,"\'>])' + esc(x) + '([\\s,"\'<]|$)'); };
// a glyph deleted with the arcs that name it or what it holds, when nothing else names them
var sbDel = function (t, g) {
  var p = span(t, g), ids = (t.slice(p[0], p[1]).match(/ id="[^"]+"/g) || []).map(function (x) { return x.slice(5, -1); });
  var arcs = (t.match(/<arc[^>]*>/g) || []).filter(function (a) { return ids.some(function (x) { return / (source|target)="([^"]+)"/.test(a) && (a.indexOf('source="' + x + '"') >= 0 || a.indexOf('target="' + x + '"') >= 0); }); }).map(function (a) { return / id="([^"]+)"/.exec(a)[1]; });
  var gone = ids.concat(arcs), out = arcs.concat([g]).reduce(cut, t).replace(/idList="([^"]*)"/g, function (m, l) { return 'idList="' + l.split(' ').filter(function (x) { return gone.indexOf(x) < 0; }).join(' ') + '"'; });   // as the editor deletes: out of the styles' lists too
  return ids.concat(arcs).some(function (x) { return tok(x).test(out); }) ? null : out;
};
var sD = sbG.filter(function (g) { return sbDel(sb, g) != null; })[0];
var sA = sbG.filter(function (g) { return g !== sD; })[0], sB = sbG.filter(function (g) { return g !== sD && g !== sA; })[0];
var sbGlyph = function (id, t) { var p = span(t, sA); return t.slice(p[0], p[1]).replace(/ id="([^"]+)"/g, function (m, x) { return ' id="' + id + x.slice(sA.length) + '"'; }); };
suite('SBGN-ML', sb, {
  on: ['bbox', 'start', 'end', 'next'], a: sA, b: sB, newId: 'gnew1', newId2: 'gnew2', ids: sbG.slice(0, 12).filter(function (x) { return x !== sD; }),
  rename: function (t, id) { return within(t, id, function (s) { return s.replace(/(<label text=")([^"]*)/, '$1$2 renamed'); }); },
  add: function (t) { return after(t, sA, lead(t, sA) + sbGlyph('gnew1', sb)); },
  add2: function (t) { return after(t, sB, lead(t, sB) + sbGlyph('gnew2', sb)); },
  del: function (t) { return sbDel(t, sD); },
  refTo: function (t) { return after(t, sbArc[1], lead(t, sbArc[1]) + '<arc class="consumption" id="anew" source="' + sD + '" target="' + sbSrc + '"><start x="1" y="1"/><end x="2" y="2"/></arc>'); }
});

// the review's cases, on small files written here (a tag of each kind, as the formats nest them)
console.log('# Small files');
var doc = function (groups, nodes, more) {   // groups and nodes: id -> [x, label]
  var g = Object.keys(groups).map(function (k) { return '  <grp id="' + k + '"><geo x="' + groups[k][0] + '" y="0"/><lab>' + groups[k][1] + '</lab></grp>'; });
  var n = Object.keys(nodes).map(function (k) { return '  <nd id="' + k + '"><geo x="' + nodes[k][0] + '" y="5"/><lab>' + nodes[k][1] + '</lab></nd>'; });
  return '<map>\n' + g.concat(n).join('\n') + (more || '') + '\n</map>\n';
};
var G0 = { g1: [0, 'A'], g2: [100, 'B'], g3: [200, 'C'] }, N0 = {};
for (var i = 0; i < 20; i++) N0['n' + i] = [i * 10, 'N' + i];
var with_ = function (o, k, v) { var c = JSON.parse(JSON.stringify(o)); c[k] = v; return c; };
var b0 = doc(G0, N0), m2 = doc(with_(with_(G0, 'g1', [-40, 'A']), 'g2', [60, 'B']), N0);
var r = merge3(b0, m2, doc(with_(G0, 'g3', [230, 'C']), N0));
ok('two of three groups moved here, the third moved there: not a shift of the map, all three moves kept', !r.broken && !r.clashes && r.text === doc({ g1: [-40, 'A'], g2: [60, 'B'], g3: [230, 'C'] }, N0), r.broken || '');
r = merge3(b0, m2, doc(with_(G0, 'g3', [200, 'C renamed']), N0));
ok('two of three groups moved here, the third renamed there: no clash, the name kept', !r.broken && !r.clashes && r.text.indexOf('C renamed') > 0);
var shifted = function (G, N, d) { var a = {}, c = {}; Object.keys(G).forEach(function (k) { a[k] = [G[k][0] + d, G[k][1]]; }); Object.keys(N).forEach(function (k) { c[k] = [N[k][0] + d, N[k][1]]; }); return doc(a, c); };
r = merge3(b0, shifted(G0, N0, 50), doc(G0, with_(N0, 'n3', [30, 'N3 renamed'])));
ok('the whole map shifted here, a node renamed there: the name kept, in this frame', !r.broken && !r.clashes && r.text === shifted(G0, with_(N0, 'n3', [30, 'N3 renamed']), 50), r.broken || '');
var res = function (k) { return '<prot id="' + k + '"><res id="rs1" name="S1"/><res id="rs2" name="S2"/></prot>'; };
var bR = doc(G0, N0, '\n' + res('p1') + '\n' + res('p2'));
r = merge3(bR, bR.replace('<geo x="0" y="0"/>', '<geo x="9" y="0"/>'), bR.replace('<res id="rs2" name="S2"/></prot>\n<prot id="p2">', '<res id="rs2" name="S2 changed"/></prot>\n<prot id="p2">'));
ok('an id given in every protein (residues rs1, rs2): named within each, both changes kept', !r.broken && !r.clashes && r.text.indexOf('<geo x="9"') > 0 && r.text.indexOf('S2 changed') > 0, r.broken || '');
var sz = function (x, y) { return '\n<display sizeX="' + x + '" sizeY="' + y + '"/>'; };
r = merge3(doc(G0, N0, sz(800, 600)), doc(G0, with_(N0, 'n1', [900, 'N1']), sz(950, 600)), doc(G0, with_(N0, 'n2', [-5, 'N2']), sz(820, 600)));
ok('both grew the map (its size) moving different nodes: both moves, no clash', !r.broken && !r.clashes && r.text.indexOf('<geo x="900"') > 0 && r.text.indexOf('<geo x="-5"') > 0, r.broken || r.clashes);
var bG = doc(G0, N0, '\n<gate id="r1" modifiers="n4,n5"/>');
r = merge3(bG, doc(G0, (function () { var c = with_(N0, 'x', 0); delete c.x; delete c.n6; return c; })(), '\n<gate id="r1" modifiers="n4,n5"/>'), doc(G0, N0, '\n<gate id="r1" modifiers="n4,n5"/>\n<gate id="r2" modifiers="n5,n6"/>'));
ok('a node deleted here, named in a list by a gate added there: broken, mine', !!r.broken, r.broken || 'joined');
// time on the largest demo map, the same node moved and another renamed
var big = fs.readFileSync(path.join(data, 'maps/asthmamap-mast-cell-celldesigner.xml'), 'utf8'), al = (big.match(/<celldesigner:speciesAlias id="[^"]+"/g) || []).map(function (x) { return /id="([^"]+)"/.exec(x)[1]; });
var t1 = Date.now(), rb = merge3(big, move(big, al[0], 7), move(big, al[1], 9)), ms = Date.now() - t1;
ok('the largest demo map (' + (big.length / 1e6).toFixed(1) + ' MB, ids given twice): joined, in ' + ms + ' ms', !rb.broken && !rb.clashes && rb.text === move(move(big, al[0], 7), al[1], 9) && ms < 5000, rb.broken || '');

console.log(bad ? bad + ' WRONG' : 'all ok');
process.exit(bad ? 1 : 0);
