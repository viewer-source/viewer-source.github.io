// sbgn_edit.stack and restack (where two compartments partly overlap, the
// smaller drawn in front; Bring forward and Send backward) against the converter (renderers/converter/mapconv, Python),
// on every SBGN-ML map of the demo: a large compartment and a smaller one made after it, partly overlapping (a new one
// goes first in its graph, so drawn under it), stacked (the smaller comes in front), then the small one sent backward and brought forward again; each, s2 =
// write(s, g2):
//   1. the converter's GraphML of s2 is drawn as g2 (the editor shows what the file will hold);
//   2. graphml(s2, conv(s)) is drawn the same (a draft reopened before the build);
//   3. write(s2, conv(s2)) is s2 (the file is stable).
// node tests/sbgn-stack.js [python3]
var fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), se = require(path.join(here, 'renderers/converter/sbgn_edit.js'));
var yr = require(path.join(here, 'renderers/yrender/yrender.js'));
var X = require('@xmldom/xmldom'), DP = X.DOMParser, opt = { DOMParser: DP };
var py = process.argv[2] || 'python3', files = [];
['maps/sbgn-ml', 'test-maps/sbgn-ml/pd'].map(function (p) { return path.join(here, p); }).forEach(function walk(p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); });
  else if (/\.(sbgn|nwt)$/.test(p) && !/-sbgnml\.sbgn$/.test(p)) files.push(p);
});
var DRIVER = [
  'import sys, json, contextlib, io, tempfile, os',
  'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']',
  'from mapconv import sbgnml, graphml, report',
  'out = []',
  'for t in json.load(sys.stdin):',
  '    fd, f = tempfile.mkstemp(suffix=".sbgn"); os.write(fd, t.encode("utf-8")); os.close(fd)',
  '    try:',
  '        with report.collect(), contextlib.redirect_stdout(io.StringIO()): out.append(graphml.write(sbgnml.read(f)))',
  '    except Exception as e: out.append(None)',
  '    os.remove(f)',
  'json.dump(out, sys.stdout)'].join('\n');
function conv(texts) { return JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(texts), maxBuffer: 1 << 30 }).toString()); }
function box(g, id) { var n = Array.prototype.filter.call(new DP().parseFromString(g, 'application/xml').getElementsByTagNameNS('*', 'node'), function (q) { return q.getAttribute('id') === id; })[0], geo = n.getElementsByTagNameNS('*', 'Geometry')[0]; return ['x', 'y', 'width', 'height'].map(function (a) { return parseFloat(geo.getAttribute(a)); }); }
function draw(g) { return yr.render(g, { DOMParser: DP, sbgn: true }).svg.replace(/-?\d+\.\d+/g, function (v) { return String(Math.round(parseFloat(v) * 100) / 100); }); }
var runs = files.map(function (f) { return { f: f, s: fs.readFileSync(f, 'utf8') }; });
var base = conv(runs.map(function (r) { return r.s; })), cases = [], bad = 0;
function orderOf(g) { return Array.prototype.map.call(new DP().parseFromString(g, 'application/xml').getElementsByTagNameNS('*', 'node'), function (n) { return n.getAttribute('id'); }).filter(function (id) { return /^ts_/.test(id); }); }
runs.forEach(function (r, k) {
  var g = base[k];
  if (!g) return;
  var add = function (g2, what, want) {
    var o = orderOf(g2).join(' ');
    if (o !== want) { bad++; console.log('FAIL', path.basename(r.f), what, 'order', o, 'not', want); return; }
    var s2;
    try { s2 = se.write(r.s, g2, opt); } catch (e) { bad++; console.log('FAIL', path.basename(r.f), what, 'write:', e.message); return; }
    cases.push({ r: r, g: g, g2: g2, s2: s2, what: what });
  };
  var g1 = se.add(g, { id: 'ts_big', cls: 'compartment', label: 'Big', box: [-2850, -2900, 600, 480] }, opt);
  g1 = se.add(g1, { id: 'ts_small', cls: 'compartment', label: 'Small', box: [-3000, -3000, 300, 240] }, opt);   // made after: first in its graph (add), so drawn under the big one
  var o0 = orderOf(g1).join(' ');
  var g2 = se.stack(g1, 'ts_small', opt);
  add(g2, 'stacked', 'ts_big ts_small');
  if (se.stack(g2, 'ts_small', opt) !== g2) { bad++; console.log('FAIL', path.basename(r.f), 'stacking again changed it'); }
  var m = se.stackMoves(g2, 'ts_small', opt);
  if (!m[0] || m[1]) { bad++; console.log('FAIL', path.basename(r.f), 'moves offered', m); }
  var g3 = se.restack(g2, 'ts_small', -1, opt);
  add(g3, 'sent backward', 'ts_small ts_big');
  add(se.restack(g3, 'ts_small', 1, opt), 'brought forward', 'ts_big ts_small');
  if (o0 !== 'ts_small ts_big') { bad++; console.log('FAIL', path.basename(r.f), 'made in another order', o0); }
});
var c2 = conv(cases.map(function (c) { return c.s2; }));
cases.forEach(function (c, k) {
  var name = path.basename(c.r.f) + ' (' + c.what + ')', want = draw(c.g2);
  if (!c2[k]) { bad++; console.log('FAIL', name, 'the converter refused the file'); return; }
  if (draw(c2[k]) !== want) { bad++; console.log('FAIL', name, 'the converter draws it otherwise'); return; }
  if (draw(se.graphml(c.s2, c.g, opt)) !== want) { bad++; console.log('FAIL', name, 'reopened over the old base, drawn otherwise'); return; }
  if (se.write(c.s2, c2[k], opt) !== c.s2) { bad++; console.log('FAIL', name, 'not stable'); return; }
});
// a file whose compartments are in another order than its base at two levels, and one with numeric ids:
// reopened over the base it is drawn as the converter draws it, and written back unchanged
function comp(id, x, y, w, h, ref) { return '    <glyph class="compartment" id="' + id + '"' + (ref ? ' compartmentRef="' + ref + '"' : '') + '>\n      <label text="' + id + '"/>\n      <bbox x="' + x + '" y="' + y + '" w="' + w + '" h="' + h + '"/>\n    </glyph>\n'; }
function sfile(parts) { return '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.2">\n  <map language="process description">\n' + parts.join('') + '    <glyph class="macromolecule" id="m1">\n      <label text="A"/>\n      <bbox x="100" y="100" w="80" h="40"/>\n    </glyph>\n  </map>\n</sbgn>\n'; }
var D = { P1: comp('P1', 0, 0, 1000, 800), P2: comp('P2', 500, 400, 1000, 800), C1: comp('C1', 50, 50, 300, 300, 'P1'), C2: comp('C2', 200, 200, 300, 300, 'P1'), '20': comp('20', 0, 0, 400, 300), '10': comp('10', 200, 150, 300, 200) };
var pairs = [[['P1', 'P2', 'C1', 'C2'], ['P2', 'P1', 'C2', 'C1']], [['10', '20'], ['20', '10']]];
var made = conv([].concat.apply([], pairs.map(function (q) { return [sfile(q[0].map(function (i) { return D[i]; })), sfile(q[1].map(function (i) { return D[i]; }))]; })));
pairs.forEach(function (q, k) {
  var b0 = made[2 * k], c2 = made[2 * k + 1], s2 = sfile(q[1].map(function (i) { return D[i]; })), what = 'file order ' + q[1].join(' ');
  if (!b0 || !c2) { bad++; console.log('FAIL', what, 'the converter refused it'); return; }
  var g2 = se.graphml(s2, b0, opt);
  if (draw(g2) !== draw(c2)) { bad++; console.log('FAIL', what, 'reopened over the base, drawn otherwise'); }
  if (se.write(s2, g2, opt) !== s2) { bad++; console.log('FAIL', what, 'reopened and written, the file changed'); }
});
console.log(cases.length + ' stackings on ' + runs.length + ' SBGN-ML maps: ' + (bad ? bad + ' failed' : 'all right'));
process.exit(bad ? 1 : 0);
