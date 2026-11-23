// What holds what, as the editor changes it: sbgn_edit.moveInto moves a node of
// the editor's GraphML into another compartment, out of one, or out of its complex, and each format writes it.
//   SBGN-ML (the demo's SBGN-ML maps and the test maps with compartments or complexes): a glyph taken out of its
//     compartment, one put into a compartment, a compartment put into another, a complex's member taken out (to the map,
//     or to a compartment); s2 = write(s, g2). Checked: the glyph's compartmentRef in s2, a member now a top glyph; the
//     converter's GraphML of s2 nests every node as g2 does; graphml(s2, conv(s)) too (a draft reopened on an older
//     build); write(s2, conv(s2)) is s2 (stable); yrender draws g2; every other glyph and arc is as in s
//     (tests/lib/untouched.js; touched: what moved with what it holds).
//   CellDesigner (every demo map with a compartment): an alias taken out of its compartment and one put into another,
//     a compartment put into another; cd_edit.js writes what the previous release writes (tests/compare.js); the alias's
//     compartmentAlias and its species' compartment, a compartment's outside, as CellDesigner writes them; the GraphML
//     made again from it nests the alias as moved; every other element is as before (tests/lib/untouched.js; touched:
//     the alias, its species, a compartment's own elements, a complex a member left, the members of what moved). nestCheck lets a complex's member out (cd_make.leave writes it) and refuses one copy of a species drawn
//     twice in one compartment.
//   GraphML (every demo yEd map with a compartment): a node taken out of its compartment and put into another: the
//     GraphML reads as XML, nests it there, and yrender draws it.
//   The editor's rules (editor/src/core.js regroup, lifted out and run on the demo maps' GraphML, CellDesigner's as
//     cd_edit makes it): a resize that changes nothing moves nothing; a compartment made 8 wider lets nothing go; a node
//     nudged inside its holder stays (overlapping compartments: no switching); a Shift drag of a member keeps it until it
//     is fully out; a compartment moved by itself lets go only what no longer overlaps it; one moved plain over free glyphs takes them in, only what it newly covers; one moved past its
//     holder's edge stays in it (its holder grows), one resized past it leaves it and holds what it now covers; what
//     grows (grown: PAD round an inside member, an edge member kept crossing, one dragged inward nothing).
//   node tests/membership.js [python]   (default: python3; the converter, which reads the SBGN-ML maps)
var fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), se = require(path.join(here, 'renderers/converter/sbgn_edit.js')), ed = require(path.join(here, 'renderers/converter/cd_edit.js'));
var yr = require(path.join(here, 'renderers/yrender/yrender.js'));
var DP = require('@xmldom/xmldom').DOMParser, opt = { DOMParser: DP };
var U = require('./lib/untouched.js'), py = process.argv[2] || 'python3', bad = 0, ran = 0, C = require('./compare.js').open('membership'), edB = C.base('renderers/converter/cd_edit.js');
var GN = 'http://graphml.graphdrawing.org/xmlns', YN = 'http://www.yworks.com/xml/graphml';
function fail(tag, m) { bad++; console.log('DIFF', tag, '|', m); }
function xml(t, tag) { var errs = [], d; try { d = new DP({ onError: function (l, m) { if (l !== 'warning') errs.push(m); } }).parseFromString(t.replace(/^\ufeff/, ''), 'application/xml'); } catch (e) { errs.push(e.message); } if (errs.length) fail(tag, 'XML: ' + errs[0]); return d; }
function ups(g) {   // node id -> the id of the node holding it, and which nodes are compartments, complexes
  var d = new DP().parseFromString(g, 'application/xml'), U = {}, K = {};
  Array.prototype.forEach.call(d.getElementsByTagNameNS(GN, 'node'), function (n) {
    var p = n.parentNode; while (p && p.nodeType === 1 && p.localName !== 'node') p = p.parentNode;
    U[n.getAttribute('id')] = p && p.nodeType === 1 ? p.getAttribute('id') : null;
    var grp = n.getAttribute('yfiles.foldertype') === 'group', r = n.getElementsByTagNameNS(YN, 'Realizers')[0], r0 = r ? Array.prototype.filter.call(r.childNodes, function (c) { return c.nodeType === 1; })[0] : null;
    var gen = n.getElementsByTagNameNS(YN, 'GenericNode')[0] || n.getElementsByTagNameNS(YN, 'GenericGroupNode')[0];
    K[n.getAttribute('id')] = grp && r0 && r0.localName === 'GroupNode' ? 'comp' : (gen && /Complex$/.test(gen.getAttribute('configuration') || '')) || (r0 && r0.localName === 'GenericGroupNode') ? 'complex' : '';
  });
  return { U: U, K: K };
}
function holds(t, ids) {   // what moving ids may touch: each id with what it holds
  var up = {}, d = new DP().parseFromString(t.replace(/^\ufeff/, ''), 'application/xml'), set = {};
  (function walk(n, h) { Array.prototype.forEach.call(n.childNodes, function (k) { if (k.nodeType !== 1) return; var id = k.getAttribute('id'); if (id) up[id] = h; walk(k, id || h); }); })(d, null);
  ids.forEach(function (id) { set[id] = true; });
  return function (id) { for (var x = id; x; x = up[x]) if (set[x]) return true; return false; };
}
function sameNest(a, b, ids) { return ids.filter(function (id) { return a.U[id] !== b.U[id]; }); }

// ---------- SBGN-ML ----------
var files = ['maps/sbgn-ml/glycolysis-sbgn.sbgn', 'maps/sbgn-ml/glycogen-muscle-sbgn.sbgn', 'downloads/srebp-sbgn.sbgn', 'downloads/estrogen-sbgn.sbgn',
  'test-maps/sbgn-ml/pd/newt-unstable/neuronal_muscle_signaling.nwt', 'test-maps/sbgn-ml/pd/sbgn-website/downloads/examples/central_plant_metabolism.sbgn']
  .map(function (f) { return path.join(here, f); }).filter(function (f) { return fs.existsSync(f); });
var DRIVER = ['import sys, json, contextlib, io', 'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']', 'from mapconv import sbgnml, graphml, report',
  'out = []', 'for f in json.load(sys.stdin):', '    try:', '        with report.collect(), contextlib.redirect_stdout(io.StringIO()): out.append(graphml.write(sbgnml.read(f)))', '    except Exception as e: out.append(None)',
  'json.dump(out, sys.stdout)'].join('\n');
function conv(paths) { return JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(paths), maxBuffer: 1 << 30 }).toString()); }
var os = require('os'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'membership-')), sjobs = [];
var bases = conv(files);
files.forEach(function (f, i) {
  var g = bases[i];
  if (!g) return;
  var s = fs.readFileSync(f, 'utf8'), I = ups(g), ids = Object.keys(I.U).filter(function (id) { return id.indexOf('|') < 0; });
  var comps = ids.filter(function (id) { return I.K[id] === 'comp'; }), plain = ids.filter(function (id) { return !I.K[id]; });
  var inComp = plain.filter(function (id) { return I.U[id] && I.K[I.U[id]] === 'comp'; }), atTop = plain.filter(function (id) { return !I.U[id]; });
  var member = plain.filter(function (id) { return I.U[id] && I.K[I.U[id]] === 'complex'; });
  var add = function (what, moves) { sjobs.push({ f: f, s: s, g: g, what: what, moves: moves }); };
  if (inComp.length) add('glyph out of its compartment', [[inComp[0], null]]);
  if (atTop.length && comps.length) add('glyph into a compartment', [[atTop[0], comps[comps.length - 1]]]);
  if (inComp.length && comps.length > 1) add('glyph to another compartment', [[inComp[inComp.length - 1], comps.filter(function (c) { return c !== I.U[inComp[inComp.length - 1]]; })[0]]]);
  if (comps.length > 1) { var c0 = comps.filter(function (c) { return !I.U[c]; }); if (c0.length > 1) add('compartment into another', [[c0[0], c0[1]]]); }
  if (member.length) add('member out of its complex', [[member[0], null]]);
  if (member.length > 1 && comps.length) add('member out to a compartment', [[member[member.length - 1], comps[0]]]);
  if (member.length && comps.length) add('member out, then its complex into a compartment', [[member[0], null], [I.U[member[0]], comps[comps.length - 1]]]);
});
var outs = sjobs.map(function (j, n) {
  try { j.g2 = se.moveInto(j.g, j.moves); j.s2 = se.write(j.s, j.g2, opt); } catch (e) { j.err = e && e.message || String(e); return null; }
  var p = path.join(tmp, n + path.extname(j.f)); fs.writeFileSync(p, j.s2); return p;
});
var conv2 = conv(outs.filter(Boolean)), k2 = 0;
sjobs.forEach(function (j, n) {
  var tag = path.basename(j.f) + ' ' + j.what + ' ' + j.moves.map(function (m) { return m[0] + ' -> ' + m[1]; }).join(', ');
  ran++;
  if (j.err) return fail(tag, 'error: ' + j.err);
  var c2 = conv2[k2++], A = ups(j.g2), ids = Object.keys(A.U), d = xml(j.s2, tag);
  if (!c2) return fail(tag, 'the converter cannot read the file written');
  var miss = sameNest(A, ups(c2), ids);
  if (miss.length) fail(tag, 'the converter nests otherwise: ' + miss.slice(0, 4).join(', '));
  j.moves.forEach(function (m) {
    var el = Array.prototype.filter.call(d.getElementsByTagName('glyph'), function (x) { return x.getAttribute('id') === m[0]; })[0];
    if (!el) return fail(tag, m[0] + ' gone');
    var cref = el.getAttribute('compartmentRef') || null;
    if (el.parentNode.localName !== 'map') fail(tag, m[0] + ' still inside ' + el.parentNode.getAttribute('id'));
    else if (cref !== m[1] && A.U[m[0]] === m[1]) fail(tag, m[0] + ' compartmentRef ' + cref);
  });
  var re = se.graphml(j.s2, j.g, opt), miss2 = sameNest(A, ups(re), ids);
  if (miss2.length) fail(tag, 'reopened on the old build, nested otherwise: ' + miss2.slice(0, 4).join(', '));
  if (se.write(j.s2, c2, opt) !== j.s2) fail(tag, 'not stable: written again it changes');
  try { yr.render(j.g2, { DOMParser: DP }); } catch (e) { fail(tag, 'yrender: ' + (e && e.message || e)); }
  if (se.write(j.s, j.g, opt) !== j.s) fail(tag, 'the file without a change is not written as it was');
  U.diff(j.s, j.s2, holds(j.s, j.moves.map(function (m) { return m[0]; })), opt).slice(0, 2).forEach(function (u) { fail(tag, 'untouched: ' + u); });
});

// ---------- CellDesigner ----------
var cfiles = fs.readdirSync(path.join(here, 'maps')).filter(function (f) { return /-celldesigner\.xml$/.test(f); }).map(function (f) { return path.join(here, 'maps', f); });
var cjobs = [];
cfiles.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8'), g = ed.graphml(t, null, opt), I = ups(g), d = ed.drawing(t, opt);
  var spOf = {}; d.alias.forEach(function (A, id) { (spOf[A[2].getAttribute('species')] = spOf[A[2].getAttribute('species')] || []).push(id); });
  var ids = Object.keys(I.U).filter(function (id) { return id.indexOf('|') < 0; }), comps = ids.filter(function (id) { return I.K[id] === 'comp'; });
  if (!comps.length) return;
  var single = ids.filter(function (id) { return !I.K[id] || I.K[id] === 'complex'; }).filter(function (id) { var A = d.alias.get(id); return A && !A[2].getAttribute('complexSpeciesAlias') && spOf[A[2].getAttribute('species')].length === 1; });
  var inC = single.filter(function (id) { return I.U[id]; }), top = single.filter(function (id) { return !I.U[id]; });
  if (inC.length) cjobs.push({ f: f, t: t, g: g, what: 'alias out of its compartment', moves: [[inC[0], null]] });
  if (top.length) cjobs.push({ f: f, t: t, g: g, what: 'alias into a compartment', moves: [[top[0], comps[0]]] });
  if (inC.length && comps.length > 1) { var o = comps.filter(function (c) { return c !== I.U[inC[inC.length - 1]]; })[0]; cjobs.push({ f: f, t: t, g: g, what: 'alias to another compartment', moves: [[inC[inC.length - 1], o]] }); }
  var c0 = comps.filter(function (c) { return !I.U[c]; });
  if (c0.length > 1) cjobs.push({ f: f, t: t, g: g, what: 'compartment into another', moves: [[c0[0], c0[1]]], comp: true });
  var mem = ids.filter(function (id) { var A = d.alias.get(id); return A && A[2].getAttribute('complexSpeciesAlias'); })[0];
  // a complex member taken out (Shift) is allowed: cd_make.leave writes it as a species after the move
  // nestCheck reads a document already parsed (the editor's kept one, opt.doc) as it reads the text: each case asked both ways
  var nd = Object.assign({}, opt, { doc: new opt.DOMParser().parseFromString(t, 'application/xml') }), nest = function (mv) {
    var a = ed.nestCheck(t, mv, opt), b = ed.nestCheck(t, mv, nd);
    if (a !== b) fail(path.basename(f) + ' nestCheck', 'the answer from the parsed document differs from the text\'s: ' + a + ' / ' + b);
    return a;
  };
  if (mem) { ran++; var w = nest([[mem, null]]); if (w) fail(path.basename(f) + ' nestCheck', 'a complex member taken out was refused: ' + w); }
  var twice = Object.keys(spOf).filter(function (s) { return spOf[s].length > 1 && spOf[s].every(function (a) { return !d.alias.get(a)[2].getAttribute('complexSpeciesAlias'); }); })[0];
  if (twice) {
    ran++;
    var a0 = spOf[twice][0], to = comps.filter(function (c) { return c !== I.U[a0]; })[0] || null;
    if (to !== (I.U[a0] || null) && !nest([[a0, to]])) fail(path.basename(f) + ' nestCheck', 'one copy of a species drawn twice moved alone was not refused');
    if (nest(spOf[twice].map(function (a) { return [a, to]; }))) fail(path.basename(f) + ' nestCheck', 'all copies of a species moved together were refused');
  }
});
cjobs.forEach(function (j) { j.g2 = se.moveInto(j.g, j.moves); });
function kept(tag, t, g, out) { if (C.check(tag, out, edB && edB.apply(t, g, opt)) === 'different') fail(tag, 'not as the previous release writes it'); }
cjobs.forEach(function (j, n) {
  var tag = path.basename(j.f) + ' ' + j.what + ' ' + j.moves.map(function (m) { return m[0] + ' -> ' + m[1]; }).join(', '), out;
  ran++;
  if (ed.nestCheck(j.t, j.moves, opt)) return fail(tag, 'refused: ' + ed.nestCheck(j.t, j.moves, opt));
  try { out = ed.apply(j.t, j.g2, opt); } catch (e) { return fail(tag, 'JavaScript: ' + (e && e.message || e)); }
  kept(tag, j.t, j.g2, out);
  xml(out, tag);
  var m = j.moves[0], cmpOf = function (ca) { return ca ? new RegExp('<celldesigner:compartmentAlias id="' + ca + '" compartment="([^"]*)"').exec(out)[1] : 'default'; };
  if (j.comp) {
    var cid = cmpOf(m[0]), want = cmpOf(m[1]), tg = new RegExp('<compartment [^>]*\\bid="' + cid + '"[^>]*>').exec(out)[0];
    if (tg.indexOf('outside="' + want + '"') < 0) fail(tag, 'outside not ' + want + ': ' + tg);
    return;
  }
  var at = new RegExp('<celldesigner:(?:complexS|s)peciesAlias id="' + m[0] + '"[^>]*>').exec(out)[0], ca = /compartmentAlias="([^"]*)"/.exec(at);
  if ((ca ? ca[1] : null) !== m[1]) fail(tag, 'compartmentAlias ' + (ca && ca[1]));
  var sid = /species="([^"]*)"/.exec(at)[1], sp = new RegExp('<species [^>]*\\bid="' + sid + '"[^>]*>').exec(out)[0];
  if (sp.indexOf('compartment="' + cmpOf(m[1]) + '"') < 0) fail(tag, 'species ' + sp);
  var B = ups(ed.graphml(out, null, opt));
  if (B.U[m[0]] !== m[1]) fail(tag, 'the GraphML made again holds it in ' + B.U[m[0]]);
  if (ed.apply(j.t, j.g, opt) !== j.t) fail(tag, 'no change is not written as it was');
  var sp = function (al) { var q = new RegExp('<celldesigner:(?:complexS|s)peciesAlias id="' + al + '"[^>]*>').exec(j.t); return q && /species="([^"]*)"/.exec(q[0])[1]; };
  var mine = [m[0], sp(m[0])];
  (j.t.match(/<celldesigner:speciesAlias [^>]*complexSpeciesAlias="[^"]*"[^>]*>/g) || []).forEach(function (q) { if (q.indexOf('complexSpeciesAlias="' + m[0] + '"') >= 0) { var a = /\sid="([^"]*)"/.exec(q)[1]; mine.push(a, sp(a)); } });
  if (j.comp) mine.push(new RegExp('<celldesigner:compartmentAlias id="' + m[0] + '" compartment="([^"]*)"').exec(j.t)[1]);
  U.diff(j.t, out, mine, opt).slice(0, 2).forEach(function (u) { fail(tag, 'untouched: ' + u); });
});

(function () {   // a complex moved out of its compartment whose members carry a compartmentAlias (the mast cell map's do): theirs follows
  var f = path.join(here, 'maps/asthmamap-mast-cell-celldesigner.xml'), t = fs.readFileSync(f, 'utf8'), g = ed.graphml(t, null, opt), I = ups(g);
  var tags = t.match(/<celldesigner:(?:complexS|s)peciesAlias [^>]*>/g) || [];
  var cx = tags.filter(function (q) { return /^<celldesigner:complexSpeciesAlias/.test(q) && /compartmentAlias="/.test(q); }).map(function (q) { return /\sid="([^"]*)"/.exec(q)[1]; })
    .filter(function (id) { return tags.some(function (q) { return q.indexOf(' complexSpeciesAlias="' + id + '"') >= 0 && /compartmentAlias="/.test(q); }) && !ed.nestCheck(t, [[id, null]], opt); })[0];
  ran++;
  if (!cx) return fail('mast cell', 'no complex whose members carry a compartmentAlias');
  var gx = se.moveInto(g, [[cx, null]]), out = ed.apply(t, gx, opt);
  kept('mast cell ' + cx + ' out', t, gx, out);
  var left = (out.match(/<celldesigner:(?:complexS|s)peciesAlias [^>]*>/g) || []).filter(function (q) { return q.indexOf(' complexSpeciesAlias="' + cx + '"') >= 0 && /compartmentAlias="/.test(q); });
  if (left.length) fail('mast cell ' + cx + ' out', 'a member keeps its old compartmentAlias: ' + left[0]);
})();

(function () {   // an alias moved across its compartment's border: its species' positionToCompartment transmembrane, back inside: inside (CellDesigner 4.4)
  var f = path.join(here, 'maps/srebp-celldesigner.xml'), t = fs.readFileSync(f, 'utf8'), g = ed.graphml(t, null, opt);
  var geo = function (gt, id) { var m = new RegExp('<node id="' + id + '"[^>]*>[^]*?<y:Geometry ([^>]*)>').exec(gt)[1]; return ['x', 'y', 'width', 'height'].map(function (k) { return +new RegExp(k + '="([^"]*)"').exec(m)[1]; }); };
  var setX = function (gt, id, x) { var i = gt.indexOf('<node id="' + id + '"'), j = gt.indexOf('<y:Geometry ', i), e = gt.indexOf('>', j); return gt.slice(0, j) + gt.slice(j, e).replace(/\sx="[^"]*"/, ' x="' + x + '"') + gt.slice(e); };
  var a = 'sa_n2_n6', c = geo(g, 'ca_n2'), b = geo(g, a), g1 = setX(g, a, c[0] + c[2] - b[2] / 2), pos = function (tt) { return /<species [^>]*id="s_n2_n6"[^]*?<celldesigner:positionToCompartment>([^<]*)</.exec(tt)[1]; };
  var out = ed.apply(t, g1, opt), gb = setX(ed.graphml(out, null, opt), a, c[0] + 40), out2 = ed.apply(out, gb, opt);
  ran += 3;
  kept('srebp ' + a + ' across the border', t, g1, out); kept('srebp ' + a + ' back inside', out, gb, out2);
  if (pos(out) !== 'transmembrane') fail('srebp ' + a + ' across the border', 'positionToCompartment ' + pos(out));
  if (pos(out2) !== 'inside') fail('srebp ' + a + ' back inside', 'positionToCompartment ' + pos(out2));
  var g3 = se.moveInto(setX(ed.graphml(out, null, opt), a, c[0] + c[2] + 200), [[a, null]]), out3 = ed.apply(out, g3, opt);   // from the edge out of every compartment
  ran++;
  if (pos(out3) !== 'inside') fail('srebp ' + a + ' out of every compartment', 'positionToCompartment ' + pos(out3));
  kept('srebp ' + a + ' out of every compartment', out, g3, out3);
})();

// ---------- GraphML ----------
var gfiles = fs.readdirSync(path.join(here, 'maps')).filter(function (f) { return /\.graphml$/.test(f); }).map(function (f) { return path.join(here, 'maps', f); });
var gn = 0;
gfiles.forEach(function (f) {
  var g = fs.readFileSync(f, 'utf8'), I = ups(g), ids = Object.keys(I.U), comps = ids.filter(function (id) { return I.K[id] === 'comp'; });
  var inC = ids.filter(function (id) { return !I.K[id] && I.U[id] && I.K[I.U[id]] === 'comp'; });
  if (!inC.length) return;
  var moves = [[inC[0], null]];
  if (comps.length > 1) moves.push([inC[inC.length - 1], comps.filter(function (c) { return c !== I.U[inC[inC.length - 1]] && c !== inC[0]; })[0]]);
  var tag = path.basename(f) + ' ' + moves.map(function (m) { return m[0] + ' -> ' + m[1]; }).join(', '), g2;
  ran++; gn++;
  try { g2 = se.moveInto(g, moves); } catch (e) { return fail(tag, 'nest: ' + (e && e.message || e)); }
  xml(g2, tag);
  var A = ups(g2);
  moves.forEach(function (m) { if (A.U[m[0]] !== (m[1] || null)) fail(tag, m[0] + ' held by ' + A.U[m[0]]); });
  ids.forEach(function (id) { if (!moves.some(function (m) { return m[0] === id; }) && A.U[id] !== I.U[id]) fail(tag, id + ' moved too'); });
  var bare = function (x) { return x.replace(/<\/?graph(?=[\s>\/])[^>]*>/g, '').replace(/\s+/g, '').length; };   // a graph made for a group that had none aside
  if (bare(g2) !== bare(g)) fail(tag, 'text lost or gained');
  try { yr.render(g2, { DOMParser: DP }); } catch (e) { fail(tag, 'yrender: ' + (e && e.message || e)); }
});

// ---------- the editor's rules (regroup) ----------
var core = fs.readFileSync(path.join(here, 'editor/src/core.js'), 'utf8');
function lift(name) { var i = core.indexOf('    function ' + name + '('); if (i < 0) throw new Error('no ' + name + ' in core.js'); var j = core.indexOf('\n    function ', i + 10), k = core.indexOf('\n    //', i + 10); return core.slice(i, Math.min(j < 0 ? 1e9 : j, k < 0 ? 1e9 : k)); }
// the paddings as Settings keeps them (core.js pads): compartments 1 here, as these cases were set, complexes As Repack
var PADS = 'var PAD_KEY = "k", localStorage = { getItem: function () { return JSON.stringify({ comp: 1, cx: "repack" }); } };\n';
var CODE = PADS + ['setText', 'pads', 'cxRoom', 'inBox', 'overlap', 'under', 'notIn', 'cdOwn', 'holder', 'regroup', 'inComplex', 'grown', 'drawnOut', 'tops', 'extOf'].map(lift).join('\n');
var LAY = require(path.join(here, 'renderers/layout/layout.js'));   // extOf's layout.extent
function editorOf(g, cd) {   // the editor's nodes2 (up, kids, inside, comp, hub, shape), as parse() reads them
  var d = new DP().parseFromString(g, 'application/xml'), N = [], byEl = new Map();
  Array.prototype.forEach.call(d.getElementsByTagNameNS(GN, 'node'), function (n) { byEl.set(n, N.length); N.push({ el: n, id: n.getAttribute('id') }); });
  var owner = function (e) { for (var p = e.parentNode; p; p = p.parentNode) if (p.localName === 'node') return p; return null; };
  N.forEach(function (n) {
    n.inside = Array.prototype.map.call(n.el.getElementsByTagNameNS(GN, 'node'), function (c) { return byEl.get(c); });
    n.kids = n.inside.filter(function (c) { return owner(N[c].el) === n.el; });
    var rs = n.el.getElementsByTagNameNS(YN, 'Realizers')[0], r = rs ? Array.prototype.filter.call(rs.childNodes, function (c) { return c.nodeType === 1; })[+rs.getAttribute('active') || 0] : null;
    if (!r) Array.prototype.forEach.call(n.el.childNodes, function (dd) { if (dd.nodeType === 1 && dd.localName === 'data') Array.prototype.forEach.call(dd.childNodes, function (c) { if (!r && c.nodeType === 1 && c.namespaceURI === YN) r = c; }); });
    var cfg = r ? r.getAttribute('configuration') || '' : '';
    n.hub = !cd && /sbgn\.(Process|Operator)$/.test(cfg);
    n.comp = n.el.getAttribute('yfiles.foldertype') === 'group' && !/omplex/.test(cfg);
    n.shape = { kind: /^Generic/.test(r ? r.localName : '') ? cfg.replace('com.yworks.sbgn.', '') : 'rectangle' };
    var geo = r.getElementsByTagNameNS(YN, 'Geometry')[0];
    n.box = ['x', 'y', 'width', 'height'].map(function (k) { return parseFloat(geo.getAttribute(k)); });
    n.up = null;
    var ins = r.getElementsByTagNameNS(YN, 'Insets')[0], iv = function (k) { return ins ? parseFloat(ins.getAttribute(k + 'F') || ins.getAttribute(k)) || 0 : 0; };
    n.ins = [iv('left'), iv('top'), iv('right'), iv('bottom')]; n.lab = { t: 0, b: 0 };
    Array.prototype.forEach.call(r.childNodes, function (l) {   // its own labels inside, at the top or the bottom (as parse())
      if (l.nodeType !== 1 || l.localName !== 'NodeLabel' || l.getAttribute('modelName') !== 'internal' || l.getAttribute('visible') === 'false') return;
      var sd = (l.getAttribute('modelPosition') || '').charAt(0);
      if (sd === 't' || sd === 'b') n.lab[sd] = Math.max(n.lab[sd], parseFloat(l.getAttribute('height')) || 0);
    });
  });
  N.forEach(function (n, i) { n.kids.forEach(function (c) { N[c].up = i; }); });
  var boxOf = function (i) { return N[i].box.slice(); };
  var api = new Function('nodes2', 'boxOf', 'shared', 'window', CODE + '\nreturn { regroup: regroup, under: under, grown: grown };')(N, boxOf, { cd: cd }, { layout: LAY });   // cd: the editor's shared.cd (state.js)
  api.N = N; api.boxOf = boxOf;
  return api;
}
var rmaps = fs.readdirSync(path.join(here, 'maps')).filter(function (f) { return /\.graphml$|-celldesigner\.xml$/.test(f); }), rn = 0;
rmaps.forEach(function (f) {
  var cd = /celldesigner/.test(f), t = fs.readFileSync(path.join(here, 'maps', f), 'utf8'), g = cd ? ed.graphml(t, null, opt) : t, E = editorOf(g, cd), N = E.N, B = E.boxOf;
  var shifted = function (set, dx, dy) { return function (k) { var b = B(k); return set.has(k) ? [b[0] + dx, b[1] + dy, b[2], b[3]] : b; }; };
  var named = function (m) { var o = []; m.forEach(function (t2, i) { o.push(N[i].id + '->' + (t2 == null ? null : N[t2].id)); }); return o.slice(0, 4).join(', '); };
  N.forEach(function (n, i) {
    if (n.id.indexOf('|') >= 0) return;
    if (n.comp) {   // a resize to the same box, and 8 units wider: nothing changes holder
      rn++;
      var m = E.regroup('box', new Set([i]));
      if (m.size) fail(f + ' ' + n.id, 'a resize to the same box regroups ' + named(m));
      var w8 = function (k) { var b = B(k); return k === i ? [b[0], b[1], b[2] + 8, b[3]] : b; }, m8 = E.regroup('box', new Set([i]), w8, B);
      m8.forEach(function (t2, k) { if (k !== i && !(t2 === i || (t2 != null && E.under(t2, i)))) fail(f + ' ' + n.id, 'made 8 wider, ' + N[k].id + ' let go'); });
    }
    if (n.up != null && N[n.up].comp) {   // nudged by one: it stays where it is a member
      [[1, 0], [-1, 0], [0, 1]].forEach(function (dd) {
        var set = new Set([i].concat(n.inside)), Bn = shifted(set, dd[0], dd[1]);
        if (!inBoxT(Bn(i), B(n.up)) && !inBoxT(B(i), B(n.up))) return;
        rn++;
        var m = E.regroup('plain', set, Bn, B);
        if (m.has(i) && !(m.get(i) != null && E.under(m.get(i), n.up))) fail(f + ' ' + n.id, 'nudged inside its holder, moved to ' + named(m));
      });
    }
  });
});
function inBoxT(b, c) { return c[0] <= b[0] + 1e-6 && c[1] <= b[1] + 1e-6 && b[0] + b[2] <= c[0] + c[2] + 1e-6 && b[1] + b[3] <= c[1] + c[3] + 1e-6; }
// made-up cases on a small map: a compartment C (0 0 400 300) holding a (20 20 80 40) and b (350 120 80 40, partly out),
// a free glyph f (500 50 80 40), a compartment D (600 0 300 300) holding e (650 50 80 40)
function tiny() {
  var node = function (id, b, inner) { return '<node id="' + id + '"' + (inner != null ? ' yfiles.foldertype="group"' : '') + '><data key="d6">' + (inner != null ? '<y:ProxyAutoBoundsNode><y:Realizers active="0"><y:GroupNode><y:Geometry x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '"/><y:Insets left="15" leftF="15.0" top="15" topF="15.0" right="15" rightF="15.0" bottom="15" bottomF="15.0"/></y:GroupNode></y:Realizers></y:ProxyAutoBoundsNode></data><graph edgedefault="directed" id="' + id + ':">' + inner + '</graph></node>' : '<y:GenericNode configuration="com.yworks.sbgn.Macromolecule"><y:Geometry x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '"/></y:GenericNode></data></node>'); };
  return '<?xml version="1.0" encoding="UTF-8"?>\n<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:y="http://www.yworks.com/xml/graphml"><graph edgedefault="directed" id="G">' +
    node('C', [0, 0, 400, 300], node('a', [20, 20, 80, 40]) + node('b', [350, 120, 80, 40])) + node('f', [500, 50, 80, 40]) + node('D', [600, 0, 300, 300], node('e', [650, 50, 80, 40])) + '</graph></graphml>';
}
(function () {
  var E = editorOf(tiny(), false), N = E.N, B = E.boxOf, I = function (id) { return N.findIndex(function (n) { return n.id === id; }); };
  var mv = function (ids, dx, dy) { var set = new Set(ids.map(I)); return [set, function (k) { var b = B(k); return set.has(k) ? [b[0] + dx, b[1] + dy, b[2], b[3]] : b; }]; };
  var got = function (m) { var o = {}; m.forEach(function (t2, i) { o[N[i].id] = t2 == null ? null : N[t2].id; }); return JSON.stringify(o); };
  var check = function (what, m, want) { rn++; if (got(m) !== JSON.stringify(want)) fail('rule: ' + what, got(m) + ' wanted ' + JSON.stringify(want)); };
  var q = mv(['b'], -5, 0); check('Shift nudge of an edge member: stays', E.regroup('alone', q[0], q[1], B), {});
  q = mv(['b'], 100, 0); check('Shift drag of a member fully out: leaves', E.regroup('alone', q[0], q[1], B), { b: null });
  q = mv(['a'], 350, 0); check('Shift drag of an inside member onto the edge: stays', E.regroup('alone', q[0], q[1], B), {});
  q = mv(['C'], 0, 30); check('compartment moved by itself: what still overlaps it stays', E.regroup('alone', q[0], q[1], B), {});
  q = mv(['C'], 0, -300); check('compartment moved by itself away: what no longer overlaps it leaves', E.regroup('alone', q[0], q[1], B), { a: null, b: null });
  q = mv(['C', 'a', 'b'], 200, 0); check('compartment moved plain over the free glyph f: takes it in', E.regroup('plain', q[0], q[1], B), { f: 'C' });
  q = mv(['f'], 140, 0); check('free glyph moved fully into D: joins', E.regroup('plain', q[0], q[1], B), { f: 'D' });
  q = mv(['e'], -60, 0); check('member moved plain partly out of D: stays', E.regroup('plain', q[0], q[1], B), {});
  var r = function (id, nb) { var i = I(id); return [new Set([i]), function (k) { return k === i ? nb : B(k); }]; };
  q = r('C', [0, 0, 200, 300]); check('compartment resized smaller: what no longer overlaps it leaves (b), what still does stays (a)', E.regroup('box', q[0], q[1], B), { b: null });
  q = r('C', [0, 0, 600, 300]); check('compartment resized over f: takes it in', E.regroup('box', q[0], q[1], B), { f: 'C' });
  // growing (grown)
  var gw = function (what, ids, dx, dy, want) {
    rn++;
    var set = new Set(ids.map(I)), Bn = function (k) { var b = B(k); return set.has(k) ? [b[0] + dx, b[1] + dy, b[2], b[3]] : b; };
    var nb = E.grown(Array.from(set).filter(function (k) { return !set.has(N[k].up); }), Bn, B, function (k) { return set.has(k); }), o = {};
    Object.keys(nb).forEach(function (k) { o[N[k].id] = nb[k].map(function (v) { return Math.round(v * 1000) / 1000; }); });
    if (JSON.stringify(o) !== JSON.stringify(want)) fail('grows: ' + what, JSON.stringify(o) + ' wanted ' + JSON.stringify(want));
  };
  gw('an inside member pushed past the border: PAD (12, the default) kept', ['a'], -25, 0, { C: [-17, 0, 417, 300] });
  gw('an inside member moved inside: nothing grows', ['a'], 0, 5, {});
  gw('an edge member dragged off: the compartment grows to keep it crossing by one unit', ['b'], 100, 0, { C: [0, 0, 451, 300] });
  gw('an edge member moved along the edge: nothing grows', ['b'], 10, 30, {});
  gw('a free glyph: nothing', ['f'], 10, 0, {});
  gw('an edge member dragged fully inside: nothing grows (it is inside from then on)', ['b'], -60, 0, {});
  gw('an edge member dragged in one drag across the compartment and out past its far side: still on the edge, the compartment grows to keep it crossing', ['b'], -440, 0, { C: [-11, 0, 411, 300] });
  q = mv(['b'], -60, 0); check('edge member dragged plain fully inside: stays in its compartment', E.regroup('plain', q[0], q[1], B), {});
  // rule 2: inside D, a small compartment S; moved past D's edge it stays (D grows), resized past it it leaves, holding what it now covers
  var E2 = editorOf(tiny().replace('<node id="e">', '<node id="S" yfiles.foldertype="group"><data key="d6"><y:ProxyAutoBoundsNode><y:Realizers active="0"><y:GroupNode><y:Geometry x="800" y="200" width="60" height="60"/></y:GroupNode></y:Realizers></y:ProxyAutoBoundsNode></data><graph edgedefault="directed" id="S:"/></node><node id="e">'), false);
  N = E2.N; B = E2.boxOf; E = E2;
  q = mv(['S'], 80, 0); check('rule 2: compartment moved past its holder\'s edge stays', E.regroup('plain', q[0], q[1], B), {});
  gw('rule 2: ... and its holder grows (PAD)', ['S'], 80, 0, { D: [600, 0, 352, 300] });
  q = r('S', [550, -20, 400, 340]); check('rule 2: compartment resized past its holder\'s edge leaves it, holding what it now covers', E.regroup('box', q[0], q[1], B), { S: null, D: 'S' });
})();
// yEd's own box after a push: a compartment's member pushed 20 past the border on
// every demo GraphML map, its holders grown (grown) and their Insets and BorderInsets refitted (refit); then yEd's box of
// the holder, what it holds inside (as layout.js extent() measures it) with its Insets and BorderInsets, is the box saved
var CODE2 = PADS + 'var shared = { text: T0, cd: cd };\n' + ['setText', 'pads', 'cxRoom', 'inBox', 'overlap', 'under', 'inComplex', 'grown', 'drawnOut', 'extOf', 'refit', 'insetsOf'].map(lift).join('\n') + '\nfunction parse() { reparse(shared.text); }\nreturn { grown: grown, refit: refit, text: function () { return shared.text; } };';
var yn = 0;
fs.readdirSync(path.join(here, 'maps')).filter(function (f) { return /\.graphml$/.test(f); }).forEach(function (f) {
  var g = fs.readFileSync(path.join(here, 'maps', f), 'utf8'), E = editorOf(g, false), N = E.N;
  var i = N.findIndex(function (n, k) { return n.up != null && N[n.up].comp && !n.hub && !n.comp && n.shape.kind !== 'Complex' && inBoxT(E.boxOf(k), E.boxOf(n.up)); });
  if (i < 0) return;
  var p = N[i].up, id = N[i].id, pid = N[p].id, b = E.boxOf(i), c = E.boxOf(p), dx = c[0] + c[2] - b[0] - b[2] + 20;
  var setGeo = function (t, nid, v) { var at = t.indexOf('<node id="' + nid + '"'), j = t.indexOf('<y:Geometry ', at), e = t.indexOf('>', j), tag = t.slice(j, e); ['x', 'y', 'width', 'height'].forEach(function (k, m) { if (v[m] != null) tag = tag.replace(new RegExp('(\\s' + k + '=")[^"]*"'), '$1' + v[m] + '"'); }); return t.slice(0, j) + tag + t.slice(e); };
  var g1 = setGeo(g, id, [b[0] + dx, null, null, null]);
  for (var k = 0; k < N[i].inside.length; k++) { var q = N[N[i].inside[k]], qb = E.boxOf(N[i].inside[k]); g1 = setGeo(g1, q.id, [qb[0] + dx, null, null, null]); }
  var cur = { E: editorOf(g1, false) }, reparse = function (t) { cur.E = editorOf(t, false); N1.length = 0; cur.E.N.forEach(function (x) { N1.push(x); }); };
  var N1 = cur.E.N.slice(), bo = function (k) { return N1[k].box.slice(); };
  var api = new Function('nodes2', 'boxOf', 'cd', 'window', 'T0', 'reparse', CODE2)(N1, bo, false, { layout: LAY }, g1, reparse);
  var i1 = N1.findIndex(function (n) { return n.id === id; }), set = new Set([i1].concat(N1[i1].inside));
  var nb = api.grown([i1], bo, function (k) { var q = bo(k); return set.has(k) ? [q[0] - dx, q[1], q[2], q[3]] : q; }, function (k) { return set.has(k); }), t2 = g1;
  Object.keys(nb).forEach(function (k) { t2 = setGeo(t2, N1[k].id, nb[k].map(function (v) { return Math.round(v * 1000) / 1000; })); });
  var api2 = new Function('nodes2', 'boxOf', 'cd', 'window', 'T0', 'reparse', CODE2)(N1, bo, false, { layout: LAY }, t2, reparse);
  reparse(t2); api2.refit([id]);
  var t3 = api2.text(), E3 = editorOf(t3, false), N3 = E3.N, P = N3.findIndex(function (n) { return n.id === pid; }), cb = E3.boxOf(P);
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  N3[P].kids.forEach(function (k2) { if (!inBoxT(E3.boxOf(k2), cb)) return; var e = LAY.extent(N3[k2].el); x0 = Math.min(x0, e[0]); y0 = Math.min(y0, e[1]); x1 = Math.max(x1, e[2]); y1 = Math.max(y1, e[3]); });
  var at = t3.indexOf('<node id="' + pid + '"'), bis = /<y:BorderInsets\s[^>]*>/.exec(t3.slice(at))[0], bv = function (k2) { return +new RegExp('\\s' + k2 + 'F="([^"]*)"').exec(bis)[1]; };
  var ins = N3[P].ins, lab = N3[P].lab, yed = [x0 - ins[0] - bv('left'), y0 - ins[1] - lab.t - bv('top'), x1 + ins[2] + bv('right'), y1 + ins[3] + lab.b + bv('bottom')];
  rn++; yn++;
  if (Math.abs(yed[0] - cb[0]) > 0.01 || Math.abs(yed[1] - cb[1]) > 0.01 || Math.abs(yed[2] - cb[0] - cb[2]) > 0.01 || Math.abs(yed[3] - cb[1] - cb[3]) > 0.01)
    fail(f + ' ' + id + ' pushed out of ' + pid, "yEd's box " + yed.map(function (v) { return Math.round(v * 10) / 10; }) + ' differs from the saved ' + [cb[0], cb[1], cb[0] + cb[2], cb[1] + cb[3]].map(function (v) { return Math.round(v * 10) / 10; }));
  var m3 = N3.findIndex(function (n) { return n.id === id; }), me = LAY.extent(N3[m3].el);
  if (me[2] > cb[0] + cb[2] + 1e-6) fail(f + ' ' + id, 'its drawing sticks out of its compartment after the push');
});
console.log(yn + " GraphML pushes checked against yEd's box");
C.end('CellDesigner writes');
console.log(ran + rn + ' checks (' + rn + ' of the editor\'s rules): ' + sjobs.length + ' SBGN-ML changes on ' + files.length + ' maps, ' + cjobs.length + ' CellDesigner changes on ' + cfiles.length + ' maps, ' + gn + ' GraphML maps: ' + (bad ? bad + ' wrong' : 'all right'));
process.exit(bad ? 1 : 0);
