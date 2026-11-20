// renderers/converter/sbml_edit.js against the converter (renderers/converter/mapconv/sbml.py), on every SBML file of a
// folder (the demo's test-maps/sbml/):
//   1. nothing moved: graphml(t, conv(t)) is conv(t) and write(t, conv(t)) is t, byte for byte;
//   2. made-up moves (every third node, compartments too, every second line's bend points, one line given a bend more):
//      the converter reads the written file back to the moved places, graphml() of the written file gives them too, and
//      the file differs from the original only in numbers where no line was rewritten (and a point box put in for a
//      reaction whose glyph had none).
//   node tests/sbml-edit.js <folder of SBML files>     (needs python3 with lxml, @xmldom/xmldom)
var fs = require('fs'), path = require('path'), cp = require('child_process');
var X = require('@xmldom/xmldom'), opt = { DOMParser: X.DOMParser };
var E = require('../renderers/converter/sbml_edit.js');
var CONV = path.join(__dirname, '..', 'renderers', 'converter');
function conv(text) {
  var py = 'import sys, tempfile\nsys.path.insert(0, sys.argv[1])\nfrom mapconv import sbml, graphml, report\n' +
    'f = tempfile.NamedTemporaryFile("w", suffix=".xml", delete=False, encoding="utf-8"); f.write(sys.stdin.read()); f.close()\n' +
    'with report.collect():\n    m = sbml.read(f.name)\nsys.stdout.write(graphml.write(m))';
  return cp.execFileSync('python3', ['-c', py, CONV], { input: text, maxBuffer: 1e9, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
}
function geo(g) {   // node id -> [x, y, w, h]; edge id -> points
  var doc = new X.DOMParser().parseFromString(g, 'application/xml'), n = {}, e = {};
  Array.prototype.forEach.call(doc.getElementsByTagName('node'), function (x) {
    var q = x.getElementsByTagName('y:Geometry')[0];
    if (q && !(x.getAttribute('id') in n)) n[x.getAttribute('id')] = ['x', 'y', 'width', 'height'].map(function (k) { return parseFloat(q.getAttribute(k)); });
  });
  Array.prototype.forEach.call(doc.getElementsByTagName('edge'), function (x) {
    e[x.getAttribute('id')] = Array.prototype.map.call(x.getElementsByTagName('y:Point'), function (p) { return [parseFloat(p.getAttribute('x')), parseFloat(p.getAttribute('y'))]; });
  });
  return { n: n, e: e };
}
function moved(g, bendMore) {   // the made-up moves, written into the GraphML's text
  var k = 0, j = 0, extra = bendMore;
  g = g.replace(/(<node id="[^"]*"[^>]*>[\s\S]*?<y:Geometry )([^>]*?)(\/>)/g, function (m, a, attrs, z) {
    if (k++ % 3) return m;
    return a + attrs.replace(/\b(x|y)="([^"]*)"/g, function (mm, c, v) { return c + '="' + (parseFloat(v) + (c === 'x' ? 13 : -7)) + '"'; }) + z;
  });
  return g.replace(/<y:Path ([^>]*?)>((?:<y:Point [^>]*\/>)+)<\/y:Path>/g, function (m, attrs, pts) {
    if (j++ % 2) return m;
    pts = pts.replace(/\b(x|y)="([^"]*)"/g, function (mm, c, v) { return c + '="' + (parseFloat(v) + 5) + '"'; });
    if (extra) { extra = false; pts += pts.match(/<y:Point [^>]*\/>/)[0].replace(/x="([^"]*)"/, function (mm, v) { return 'x="' + (parseFloat(v) + 9) + '"'; }); }
    return '<y:Path ' + attrs + '>' + pts + '</y:Path>';
  });
}
function near(a, b) { return Math.abs(a - b) < 0.02; }
function diffGeo(a, b, what) {
  var bad = [];
  Object.keys(a.n).forEach(function (i) { if (!b.n[i] || a.n[i].some(function (v, k) { return !near(v, b.n[i][k]); })) bad.push(what + ' node ' + i + ' ' + JSON.stringify(a.n[i]) + ' / ' + JSON.stringify(b.n[i])); });
  Object.keys(a.e).forEach(function (i) {
    var p = a.e[i], q = b.e[i] || [];
    if (p.length !== q.length || p.some(function (v, k) { return !near(v[0], q[k][0]) || !near(v[1], q[k][1]); })) bad.push(what + ' line ' + i + ' ' + JSON.stringify(p) + ' / ' + JSON.stringify(q));
  });
  return bad;
}
var dir = process.argv[2], fails = 0, n = 0;
fs.readdirSync(dir).filter(function (f) { return /\.(sbml|xml)$/.test(f); }).sort().forEach(function (f) {
  var t = fs.readFileSync(path.join(dir, f), 'utf8'), g0;
  try { g0 = conv(t); } catch (e) { console.log('skip  ' + f + ': the converter does not draw it'); return; }
  n++;
  var bad = [];
  if (E.graphml(t, g0, opt) !== g0) bad.push('graphml(t, conv(t)) is not conv(t)');
  if (E.write(t, g0, opt) !== t) bad.push('write(t, conv(t)) is not t');
  [false, true].forEach(function (more) {
    var gm = moved(g0, more), t2 = E.write(t, gm, opt), back, want = geo(gm);
    try { back = conv(t2); } catch (e) {
      var at = String(e.stderr || '').match(/line (\d+), column (\d+)/);
      bad.push((more ? 'bend added, ' : '') + 'the written file is not read: ' + (at ? t2.split('\n')[at[1] - 1].trim().slice(0, 300) : String(e.message).slice(-200)));
      return;
    }
    bad = bad.concat(diffGeo(want, geo(back), (more ? 'bend added, ' : '') + 'read back'));
    bad = bad.concat(diffGeo(geo(back), geo(E.graphml(t2, g0, opt)), (more ? 'bend added, ' : '') + 'graphml()'));
    var strip = function (s) { return s.replace(/-?\d+(\.\d+)?([eE][-+]?\d+)?/g, '#'); };
    var put = /<([\w.-]+:)?boundingBox><([\w.-]+:)?position [^>]*\/><([\w.-]+:)?dimensions [^>]*\/><\/([\w.-]+:)?boundingBox>/g;   // a point put in for a reaction with no box
    if (!more && strip(t2.replace(put, '')) !== strip(t)) bad.push('the file changed beyond numbers');
  });
  fails += bad.length ? 1 : 0;
  console.log((bad.length ? 'FAIL  ' : 'ok    ') + f + (bad.length ? '\n  ' + bad.slice(0, 6).join('\n  ') + (bad.length > 6 ? '\n  ... ' + (bad.length - 6) + ' more' : '') : ''));
});
console.log(n + ' files, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
