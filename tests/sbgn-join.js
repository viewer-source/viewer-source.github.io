// sbgn_edit.join (a glyph dropped on a complex becomes its member, a complex on a complex too) against the
// converter (renderers/converter/mapconv, Python), on every SBGN-ML map of the demo with a complex: a macromolecule made
// and put into a complex with members, a complex made empty given a member (made a group), a complex made and put into
// another. For each, s2 = write(s, g2):
//   1. s2 holds the glyph inside the complex's glyph, without a compartmentRef;
//   2. the converter's GraphML of s2 is drawn as g2 (the editor shows what the file will hold);
//   3. graphml(s2, conv(s)) is drawn the same (a draft reopened before the build: the base has it beside the complex);
//   4. write(s2, conv(s2)) is s2 (the file is stable).
// Also: the order of drawing (yrender) puts a compartment under everything and a complex under the glyphs beside it.
// node tests/sbgn-join.js [python3]
var fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), se = require(path.join(here, 'renderers/converter/sbgn_edit.js'));
var yr = require(path.join(here, 'renderers/yrender/yrender.js'));
var X = require('@xmldom/xmldom'), DP = X.DOMParser, opt = { DOMParser: DP };
var py = process.argv[2] || 'python3';
var files = [];
['maps/sbgn-ml', 'test-maps/sbgn-ml/pd'].map(function (p) { return path.join(here, p); }).forEach(function walk(p) {
  if (!fs.existsSync(p)) return;
  var st = fs.statSync(p);
  if (st.isDirectory()) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); });
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
// numbers to 2 decimals: the file holds 4, so a name's place read back from it may differ by a thousandth on a rounding edge
function draw(g) { return yr.render(g, { DOMParser: DP, sbgn: true }).svg.replace(/-?\d+\.\d+/g, function (v) { return String(Math.round(parseFloat(v) * 100) / 100); }); }
function doc(t) { return new DP().parseFromString(t.replace(/^\ufeff/, ''), 'application/xml'); }
function byId(d, tag, id) { return Array.prototype.filter.call(d.getElementsByTagNameNS('*', tag), function (e) { return e.getAttribute('id') === id; })[0]; }
function box(g, id) { var n = byId(doc(g), 'node', id), geo = n.getElementsByTagNameNS('http://www.yworks.com/xml/graphml', 'Geometry')[0]; return ['x', 'y', 'width', 'height'].map(function (k) { return parseFloat(geo.getAttribute(k)); }); }
function complexes(g, members) {   // ids of the complexes, with members or not
  var out = [];
  Array.prototype.forEach.call(doc(g).getElementsByTagNameNS('*', 'node'), function (n) {
    var cfg = Array.prototype.some.call(n.getElementsByTagNameNS('*', '*'), function (e) { return e.parentNode.parentNode === n || e.parentNode.parentNode.parentNode.parentNode === n ? e.getAttribute('configuration') === 'com.yworks.sbgn.Complex' : false; });
    if (cfg && (n.getAttribute('yfiles.foldertype') === 'group') === members) out.push(n.getAttribute('id'));
  });
  return out;
}
var bad = 0, runs = [], texts = [];
files.forEach(function (f) {
  var s = fs.readFileSync(f, 'utf8');
  if (se.mapKind(s) === 'af') return;
  runs.push({ f: f, s: s });
});
var base = conv(runs.map(function (r) { return r.s; }));
var cases = [];
runs.forEach(function (r, k) {
  var g = base[k];
  if (!g) return;
  var full = complexes(g, true)[0];
  var mk = function (t, id, cls, b) { var D = se.defaults(r.s, opt, cls); return se.add(t, { id: id, cls: cls, label: id, box: b, fill: D.fill, font: D.font }, opt); };
  var steps = [];
  if (full) {
    var B = box(g, full);
    steps.push(['protein into a complex', function () { var t = mk(g, 'tj_m1', 'macromolecule', [B[0] + 4, B[1] + B[3] - 30, 80, 40]); return [se.join(t, 'tj_m1', full, opt), 'tj_m1', full]; }]);
    steps.push(['complex into a complex', function () { var t = mk(g, 'tj_c1', 'complex', [B[0] + 4, B[1] + 4, 144, 64]); return [se.join(t, 'tj_c1', full, opt), 'tj_c1', full]; }]);
  }
  steps.push(['protein into an empty complex', function () {
    var t = mk(g, 'tj_c2', 'complex', [-500, -500, 144, 64]); t = mk(t, 'tj_m2', 'simple chemical', [-480, -480, 40, 40]);
    return [se.join(t, 'tj_m2', 'tj_c2', opt), 'tj_m2', 'tj_c2'];
  }]);
  steps.forEach(function (st) {
    var out;
    try { out = st[1](); } catch (e) { bad++; console.log('FAIL', path.basename(r.f), st[0], 'join:', e.message); return; }
    var g2 = out[0], s2;
    try { s2 = se.write(r.s, g2, opt); } catch (e) { bad++; console.log('FAIL', path.basename(r.f), st[0], 'write:', e.message); return; }
    var gl = byId(doc(s2), 'glyph', out[1]);
    if (!gl || gl.parentNode.getAttribute('id') !== out[2] || gl.getAttribute('compartmentRef')) { bad++; console.log('FAIL', path.basename(r.f), st[0], 'not in the complex in the file'); return; }
    cases.push({ r: r, g: g, g2: g2, s2: s2, what: st[0] });
  });
});
var c2 = conv(cases.map(function (c) { return c.s2; }));
cases.forEach(function (c, k) {
  var name = path.basename(c.r.f) + ' (' + c.what + ')';
  if (!c2[k]) { bad++; console.log('FAIL', name, 'the converter refused the file'); return; }
  var want = draw(c.g2);
  if (draw(c2[k]) !== want) { bad++; console.log('FAIL', name, 'the converter draws it otherwise'); return; }
  if (draw(se.graphml(c.s2, c.g, opt)) !== want) { bad++; console.log('FAIL', name, 'reopened over the old base, drawn otherwise'); return; }
  if (se.write(c.s2, c2[k], opt) !== c.s2) { bad++; console.log('FAIL', name, 'not stable'); return; }
});
// the drawing order
var order = '<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:y="http://www.yworks.com/xml/graphml"><key for="node" id="ng" yfiles.type="nodegraphics"/><graph id="G" edgedefault="directed">' +
  ['p|Macromolecule|0', 'c|Complex|10', 'k|Compartment|-50'].map(function (q) {
    q = q.split('|');
    if (q[1] === 'Compartment') return '<node id="k" yfiles.foldertype="group"><data key="ng"><y:ProxyAutoBoundsNode><y:Realizers active="0"><y:GroupNode><y:Geometry x="-50" y="-50" width="300" height="300"/><y:Fill color="#FFFFEE" transparent="false"/><y:BorderStyle color="#000000" type="line" width="2.0"/><y:Shape type="roundrectangle"/></y:GroupNode></y:Realizers></y:ProxyAutoBoundsNode></data><graph id="k:" edgedefault="directed"/></node>';
    return '<node id="' + q[0] + '"><data key="ng"><y:GenericNode configuration="com.yworks.sbgn.' + q[1] + '"><y:Geometry x="' + q[2] + '" y="' + q[2] + '" width="80" height="40"/><y:Fill color="#EEEEEE" transparent="false"/><y:BorderStyle color="#000000" type="line" width="1.0"/></y:GenericNode></data></node>';
  }).join('') + '</graph></graphml>';
var svg = yr.render(order.replace('com.yworks.sbgn.Complex"><y:Geometry x="10" y="10" width="80" height="40"/><y:Fill color="#EEEEEE"', 'com.yworks.sbgn.Complex"><y:Geometry x="10" y="10" width="80" height="40"/><y:Fill color="#DDDDDD"'), { DOMParser: DP }).svg, at = function (c) { return svg.indexOf(c); };
if (!(at('#FFFFEE') >= 0 && at('#FFFFEE') < at('#DDDDDD') && at('#DDDDDD') < at('#EEEEEE'))) { bad++; console.log('FAIL drawing order: not compartment, complex, protein'); }
// a complex multimer given a member stays a multimer; a complex whose member is deleted is the plain complex again
var r0 = runs[0], g0 = base[0];
var D0 = se.defaults(r0.s, opt, 'complex'), gm = se.add(g0, { id: 'tj_cm', cls: 'complex', label: 'cm', box: [-900, -900, 144, 64], fill: D0.fill, font: D0.font, multimer: true }, opt);
gm = se.add(gm, { id: 'tj_mm', cls: 'macromolecule', label: 'mm', box: [-880, -880, 80, 40] }, opt);
var gj = se.join(gm, 'tj_mm', 'tj_cm', opt);
if (!/com\.yworks\.sbgn\.style\.mcount/.test(gj.slice(gj.indexOf('id="tj_cm"'), gj.indexOf('id="tj_mm"')))) { bad++; console.log('FAIL a complex multimer given a member lost its count'); }
var gd = se.remove(gj, ['tj_mm'], opt);
var cm = byId(doc(gd), 'node', 'tj_cm'), plainNow = cm && !cm.getAttribute('yfiles.foldertype') && cm.getElementsByTagNameNS('*', 'GenericNode').length === 1 && !cm.getElementsByTagNameNS('*', 'graph').length;
var grown = box(gj, 'tj_cm'), want0 = se.resize(se.remove(gm, ['tj_mm'], opt), 'tj_cm', grown, opt);   // the plain complex, at the size it grew to
if (!plainNow || draw(gd) !== draw(want0)) { bad++; console.log('FAIL a complex whose member was deleted is not the plain complex again'); }
console.log(cases.length + ' joins on ' + runs.length + ' SBGN-ML maps (PD): ' + (bad ? bad + ' failed' : 'all right'));
process.exit(bad ? 1 : 0);
