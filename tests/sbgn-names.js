// sbgn_edit.nameAt (a compartment's name in one of six places, top or bottom, left, middle or right) against
// the converter (renderers/converter/mapconv, Python), on every SBGN-ML map of the demo with a named compartment: each
// named compartment's name put in each of the six places, s2 = write(s, g2):
//   1. the converter's GraphML of s2 is drawn as g2 (the editor shows what the file will hold);
//   2. graphml(s2, conv(s)) is drawn the same (a draft reopened before the build);
//   3. write(s2, conv(s2)) is s2 (the file is stable).
// Only the places namePlaces offers (a name too wide to sit at a side is offered the middles only); each placement also
// with the compartment resized after it; a compartment unnamed in the file named here, and one made here, placed too.
// node tests/sbgn-names.js [python3]
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
var base = conv(runs.map(function (r) { return r.s; })), cases = [], bad = 0, maps = 0;
runs.forEach(function (r, k) {
  var g = base[k];
  if (!g) return;
  var doc = new DP().parseFromString(g, 'application/xml'), ids = [], all = [];
  Array.prototype.forEach.call(doc.getElementsByTagNameNS('*', 'GroupNode'), function (rz) {
    var n = rz; while (n && n.localName !== 'node') n = n.parentNode;
    if (!n || all.indexOf(n.getAttribute('id')) >= 0) return;
    all.push(n.getAttribute('id'));
    if (se.namePlaces(g, n.getAttribute('id'), opt)) ids.push(n.getAttribute('id'));
  });
  var add = function (g2, what) {
    var s2;
    try { s2 = se.write(r.s, g2, opt); } catch (e) { bad++; console.log('FAIL', path.basename(r.f), what, 'write:', e.message); return; }
    cases.push({ r: r, g: g, g2: g2, s2: s2, what: what });
  };
  if (ids.length) maps++;
  ids.slice(0, 2).forEach(function (id) {
    se.namePlaces(g, id, opt)[1].forEach(function (pos) {
      var g2 = se.nameAt(g, id, pos, opt);
      add(g2, id + ' ' + pos);
      var B = box(g2, id);   // then the compartment resized (taller and wider, from its top left): the name keeps its place
      add(se.resize(g2, id, [B[0] - 40, B[1] - 60, B[2] + 120, B[3] + 200], opt), id + ' ' + pos + ' resized');
    });
  });
  // a compartment unnamed in the file named here, and one made here, each put at the bottom right
  var bare = all.filter(function (id) { return ids.indexOf(id) < 0; })[0];
  if (bare && k % 3 === 0) add(se.nameAt(se.label(g, bare, 'Named here', opt), bare, 'br', opt), bare + ' named here, br');
  if (k % 5 === 0) {
    var gm = se.add(g, { id: 'tn_c1', cls: 'compartment', label: 'New compartment', box: [-2000, -2000, 400, 320] }, opt);
    add(se.nameAt(gm, 'tn_c1', 'bl', opt), 'new compartment, bl');
  }
});
var c2 = conv(cases.map(function (c) { return c.s2; }));
cases.forEach(function (c, k) {
  var name = path.basename(c.r.f) + ' (' + c.what + ')', want = draw(c.g2);
  if (!c2[k]) { bad++; console.log('FAIL', name, 'the converter refused the file'); return; }
  if (draw(c2[k]) !== want) { bad++; console.log('FAIL', name, 'the converter draws it otherwise'); return; }
  if (draw(se.graphml(c.s2, c.g, opt)) !== want) { bad++; console.log('FAIL', name, 'reopened over the old base, drawn otherwise'); return; }
  if (se.write(c.s2, c2[k], opt) !== c.s2) { bad++; console.log('FAIL', name, 'not stable'); return; }
});
console.log(cases.length + ' names placed on ' + maps + ' SBGN-ML maps: ' + (bad ? bad + ' failed' : 'all right'));
process.exit(bad ? 1 : 0);
