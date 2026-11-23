// Without the page (plan 3 step 5, item 7): a change run through the engines and renderers under Node, given a
// DOMParser, no browser: the map read (graphml_edit.read), one node moved (graphml_edit.place, as the editor's move
// writes it), the format's file written (cd_edit.apply, sbgn_edit.write; a yEd map is its GraphML), the file drawn
// again (cdrender, yrender) and each element drawn alone (elements().one). Checked on every map of the test set (and
// its SBGN-ML maps through the converter's GraphML): the node moved is drawn elsewhere, every element with no line at
// it drawn exactly as before; the file written changes only that node and its lines (tests/lib/untouched.js).
//   node tests/no-page.js [python]   (default: python3; the converter, for the SBGN-ML maps)
var fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), R = function (p) { return require(path.join(here, p)); };
var GE = R('renderers/converter/graphml_edit.js'), cd = R('renderers/converter/cd_edit.js'), se = R('renderers/converter/sbgn_edit.js');
var yr = R('renderers/yrender/yrender.js'), cr = R('renderers/converter/cdrender.js'), U = require('./lib/untouched.js');
var DP = require('@xmldom/xmldom').DOMParser, opt = { DOMParser: DP }, py = process.argv[2] || 'python3';
var files = [];
(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); });
  else if (/\.(graphml|xml|sbgn)$/.test(p)) files.push(p);
})(path.join(here, 'test-maps', 'test-set'));
var sbgns = files.filter(function (f) { return /\.sbgn$/.test(f); });
var DRIVER = ['import sys, json, contextlib, io', 'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']', 'from mapconv import sbgnml, graphml, report',
  'out = []', 'for f in json.load(sys.stdin):', '    try:', '        with report.collect(), contextlib.redirect_stdout(io.StringIO()): out.append(graphml.write(sbgnml.read(f)))', '    except Exception as e: out.append(None)',
  'json.dump(out, sys.stdout)'].join('\n');
var conv = {};
if (sbgns.length) JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(sbgns), maxBuffer: 1 << 30 }).toString()).forEach(function (g, i) { conv[sbgns[i]] = g; });
function within(t, ids, map) {   // an id touched: one of ids or inside one of them; map: the map's own element too (its box follows what it holds)
  var up = {}, top = {}, d = new DP().parseFromString(t.replace(/^\ufeff/, ''), 'application/xml');
  (function walk(e, h) { Array.prototype.forEach.call(e.childNodes, function (k) { if (k.nodeType !== 1) return; var id = k.getAttribute('id'); if (id) { up[id] = h; if (k.localName === 'map') top[id] = 1; } walk(k, id || h); }); })(d, null);
  return function (id) { if (map && top[id]) return true; for (var x = id; x; x = up[x]) if (ids.indexOf(x) >= 0) return true; return false; };
}
var bad = 0, ran = 0, said = 0, kinds = { yed: 0, cd: 0, sbgn: 0 };
function no(tag, m) { bad++; if (said++ < 12) console.log('DIFF ' + tag + ': ' + m); }
files.forEach(function (f) {
  var src = fs.readFileSync(f, 'utf8'), name = path.relative(here, f), kind = /\.sbgn$/.test(f) ? 'sbgn' : src.slice(0, 3000).indexOf('celldesigner') >= 0 ? 'cd' : 'yed';
  var g = kind === 'cd' ? cd.graphml(src, null, opt) : kind === 'sbgn' ? conv[f] : src;
  if (!g) return;
  var M = GE.read(g, { DOMParser: DP, cd: kind === 'cd' });   // parsing
  var at = {}; M.edges.forEach(function (e) { [e.s, e.t].forEach(function (i) { if (i != null) at[i] = (at[i] || 0) + 1; }); });
  var k = M.nodes.findIndex(function (n, i) { return at[i] && !n.kids.length && n.up == null && !n.hub && n.id.indexOf('|') < 0; });   // a top node with lines, holding nothing
  if (k < 0) return;
  var n = M.nodes[k], moved = {};
  n.geo.forEach(function (gi) { moved[gi] = [GE.fmt(GE.num(M.geos[gi], 'x') + 40), GE.fmt(GE.num(M.geos[gi], 'y') + 24)]; });
  var g2 = GE.place(g, moved, {});   // placing, as the editor's move writes it
  var lines = M.edges.filter(function (e) { return e.s === k || e.t === k; }).map(function (e) { return e.id; });
  var tag = name + ' ' + n.id;
  ran++; kinds[kind]++;
  var s2, before, after, ids;
  if (kind === 'cd') {   // the file written, then drawn
    s2 = cd.apply(src, g2, opt);
    var rx = lines.map(function (e) { return e.split('|')[0]; });
    U.diff(src, s2, [n.id].concat(rx)).slice(0, 2).forEach(function (d) { no(tag, 'file: ' + d); });
    before = cr.elements(src, opt); after = cr.elements(s2, opt);
    ids = Array.from(new cr.Drawing(s2, opt).alias.keys());
    if (JSON.stringify(before.one(n.id)) === JSON.stringify(after.one(n.id))) no(tag, 'the node moved is drawn as before');
    ids.forEach(function (id) { if (id !== n.id && JSON.stringify(before.one(id)) !== JSON.stringify(after.one(id))) no(tag, id + ' drawn otherwise'); });
    var rxs = (src.match(/<reaction [^>]*\bid="[^"]*"/g) || []).map(function (q) { return /\bid="([^"]*)"/.exec(q)[1]; });
    rxs.forEach(function (r) { if (rx.indexOf(r) < 0 && JSON.stringify(before.one(r)) !== JSON.stringify(after.one(r))) no(tag, 'reaction ' + r + ' drawn otherwise'); });
    return;
  }
  if (kind === 'sbgn') {
    s2 = se.write(src, g2, opt);
    U.diff(src, s2, within(src, [n.id].concat(lines), true)).slice(0, 2).forEach(function (d) { no(tag, 'file: ' + d); });
    g2 = se.graphml(s2, g, opt);   // the GraphML read again from the file written
  }
  if (kind === 'yed') U.diff(g, g2, [n.id]).slice(0, 2).forEach(function (d) { no(tag, 'file: ' + d); });   // a yEd map's file is its GraphML; its lines keep their text (their ends are offsets)
  before = yr.elements(g, opt); after = yr.elements(g2, opt);
  if (!before || !after) return no(tag, 'not drawn');
  if (before.one(n.id) === after.one(n.id)) no(tag, 'the node moved is drawn as before');
  var hubs = {}; M.nodes.forEach(function (q, i) { if (q.hub && M.edges.some(function (e) { return lines.indexOf(e.id) >= 0 && (e.s === i || e.t === i); })) hubs[q.id] = 1; });   // a process at its lines: its ports follow
  M.nodes.forEach(function (q) { if (q.id !== n.id && !hubs[q.id] && before.one(q.id) !== after.one(q.id)) no(tag, q.id + ' drawn otherwise'); });
  M.edges.forEach(function (e) {
    var near = lines.indexOf(e.id) >= 0 || hubs[M.nodes[e.s] && M.nodes[e.s].id] || hubs[M.nodes[e.t] && M.nodes[e.t].id];
    if (!near && before.one(e.id) !== after.one(e.id)) no(tag, 'line ' + e.id + ' drawn otherwise');
  });
});
console.log(ran + ' maps (' + kinds.yed + ' yEd, ' + kinds.cd + ' CellDesigner, ' + kinds.sbgn + ' SBGN-ML), a node moved and drawn with no page: ' + (bad ? bad + ' different' : 'only it and its lines changed'));
process.exit(bad || !ran ? 1 : 0);
