// A line's Properties on SBGN-ML maps (the full editor): an arc given a colour and a width and its source port moved, as
// the editor sets them on its GraphML (recolour, rewidth, the y:Path's sx and sy), then s2 = write(s, g2), the SBGN-ML file saved. Checks:
//   1. the converter reads s2 back with that colour, width and port (its GraphML of s2);
//   2. graphml(s2, conv(s)) carries the colour and width (a draft reopened over a build that predates it);
//   3. write(s2, conv(s2)) is s2 (the written file is stable); the colour set back to black and the width to 1 leave
//      neither (the file's own width, Newt's 1.25, given back to the line).
//   node tests/sbgn-line.js [python] SBGN-ML files ...
var path = require('path'), cp = require('child_process'), here = path.join(__dirname, '..');
var se = require(path.join(here, 'renderers/converter/sbgn_edit.js')), DP = require('@xmldom/xmldom').DOMParser, opt = { DOMParser: DP }, fs = require('fs');
var args = process.argv.slice(2), py = args[0] && !/\.(sbgn|nwt)$/.test(args[0]) ? args.shift() : 'python3';
var DRIVER = ['import sys, json, contextlib, io, tempfile, os', 'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']',
  'from mapconv import sbgnml, graphml, report', 'out = []',
  'for t in json.load(sys.stdin):',
  '    f = tempfile.NamedTemporaryFile("w", suffix=".sbgn", delete=False); f.write(t); f.close()',
  '    with report.collect(), contextlib.redirect_stdout(io.StringIO()): out.append(graphml.write(sbgnml.read(f.name)))',
  '    os.unlink(f.name)',
  'json.dump(out, sys.stdout)'].join('\n');
function conv(ts) { return JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(ts), maxBuffer: 1 << 30 }).toString()); }
function edge(g, id) { var G = new DP().parseFromString(g, 'application/xml'), es = G.getElementsByTagName('edge'); for (var i = 0; i < es.length; i++) if (es[i].getAttribute('id') === id) return es[i]; return null; }
function path0(e) { return e.getElementsByTagNameNS('*', 'Path')[0]; }
var bad = 0, n = 0;
args.forEach(function (f) {
  var s = fs.readFileSync(f, 'utf8'), g = conv([s])[0], G = new DP().parseFromString(g, 'application/xml');
  var es = Array.prototype.filter.call(G.getElementsByTagName('edge'), function (e) { return se.lineOf(e) === null; });
  // an arc leaving an entity (its source port free), else any
  var hubs = {}; Array.prototype.forEach.call(G.getElementsByTagNameNS('*', 'GenericNode'), function (r) { if (/Process|Operator|Association|Dissociation/.test(r.getAttribute('configuration') || '')) { var nd = r.parentNode.parentNode; hubs[nd.getAttribute('id')] = 1; } });
  var e = es.filter(function (x) { return !hubs[x.getAttribute('source')]; })[0];
  var free = !!e; e = e || es[0];
  if (!e) { console.log('skip', path.basename(f)); return; }
  n++;
  var id = e.getAttribute('id'), w0 = se.widthOf(e), g2 = se.rewidth(se.recolour(g, id, '#CC3300', opt), id, 2.5, opt), p = path0(e), want = [7.5, -4];
  if (free) g2 = g2.replace(new RegExp('(<edge\\b[^>]*\\sid="' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[\\s\\S]*?<y:Path\\b)[^>]*?(\\/?>)'), function (m, a, b) {
    return a + ' sx="' + want[0] + '" sy="' + want[1] + '" tx="' + p.getAttribute('tx') + '" ty="' + p.getAttribute('ty') + '"' + b; });
  var s2 = se.write(s, g2, opt), c2 = conv([s2])[0], E2 = edge(c2, id), err = [];
  if (!E2 || se.lineOf(E2) !== '#CC3300') err.push('colour not read back: ' + (E2 && se.lineOf(E2)));
  if (!E2 || se.widthOf(E2) !== 2.5) err.push('width not read back: ' + (E2 && se.widthOf(E2)));
  if (free && E2) { var q = path0(E2); if (Math.abs(+q.getAttribute('sx') - want[0]) > 0.01 || Math.abs(+q.getAttribute('sy') - want[1]) > 0.01) {
    // a start within 1.5 of the line from the glyph's centre toward the next point is read as aimed at the centre (sbgnml.at),
    // drawn the same: only another place is a failure
    var S2 = new DP().parseFromString(s2, 'application/xml'), a2 = Array.prototype.filter.call(S2.getElementsByTagNameNS('*', 'arc'), function (x) { return x.getAttribute('id') === id; })[0];
    var st = a2.getElementsByTagNameNS('*', 'start')[0], nx = a2.getElementsByTagNameNS('*', 'next')[0] || a2.getElementsByTagNameNS('*', 'end')[0];
    var P = [+st.getAttribute('x'), +st.getAttribute('y')], Q = [+nx.getAttribute('x'), +nx.getAttribute('y')], c = [P[0] - want[0], P[1] - want[1]];
    var u = [Q[0] - c[0], Q[1] - c[1]], L = Math.hypot(u[0], u[1]), off = Math.abs(u[0] * want[1] - u[1] * want[0]) / L;
    if (!(+q.getAttribute('sx') === 0 && +q.getAttribute('sy') === 0 && off <= 1.5)) err.push('port read back as ' + q.getAttribute('sx') + ',' + q.getAttribute('sy'));
  } }
  var E3 = edge(se.graphml(s2, g, opt), id);
  if (!E3 || se.lineOf(E3) !== '#CC3300') err.push('graphml() over the old build lost the colour');
  if (!E3 || se.widthOf(E3) !== 2.5) err.push('graphml() over the old build lost the width');
  if (se.write(s2, c2, opt) !== s2) err.push('write not stable');
  var s3 = se.write(s2, se.rewidth(se.recolour(c2, id, null, opt), id, w0, opt), opt), E4 = edge(conv([s3])[0], id);
  if (!E4 || se.lineOf(E4) !== null) err.push('black not back: ' + (E4 && se.lineOf(E4)));
  if (!E4 || se.widthOf(E4) !== w0) err.push('width ' + w0 + ' not back: ' + (E4 && se.widthOf(E4)));
  console.log((err.length ? 'FAIL ' : 'ok   ') + path.basename(f) + ' ' + id + (free ? ' (colour, width, port)' : ' (colour, width)') + (err.length ? ': ' + err.join('; ') : ''));
  bad += err.length ? 1 : 0;
});
// an arc in one red style with a glyph, set back to black: the glyph keeps its red border, the arc leaves the style,
// no style is added; then coloured blue: a style of its own (arcs' and glyphs' styles apart), no width written
(function () {
  var R = 'http://www.sbml.org/sbml/level3/version1/render/version1', s = '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3">\n  <map language="process description">\n    <extension>\n      <renderInformation xmlns="' + R + '" id="ri">\n        <listOfColorDefinitions>\n          <colorDefinition id="red" value="#ff0000"/>\n        </listOfColorDefinitions>\n        <listOfStyles>\n          <style id="s1" idList="g1 a1"><g stroke="red"/></style>\n        </listOfStyles>\n      </renderInformation>\n    </extension>\n    <glyph class="macromolecule" id="g1">\n      <label text="A"/>\n      <bbox x="10" y="10" w="80" h="40"/>\n    </glyph>\n    <glyph class="macromolecule" id="g2">\n      <label text="B"/>\n      <bbox x="200" y="10" w="80" h="40"/>\n    </glyph>\n    <arc class="stimulation" id="a1" source="g1" target="g2">\n      <start x="90" y="30"/>\n      <end x="200" y="30"/>\n    </arc>\n  </map>\n</sbgn>\n';
  var g = conv([s])[0], err = [];
  if (se.lineOf(edge(g, 'a1')) !== '#FF0000') err.push('red not read');
  var s2 = se.write(s, se.recolour(g, 'a1', null, opt), opt);
  if (!/idList="g1"/.test(s2) || /a1"?>|<style[^>]*idList="[^"]*a1/.test(s2.replace(/<arc[\s\S]*$/, '')) || (s2.match(/<style\b/g) || []).length !== 1) err.push('black: ' + s2.match(/<style\b[^>]*>/g));
  var s3 = se.write(s2, se.recolour(conv([s2])[0], 'a1', '#0000FF', opt), opt), sts = s3.match(/<style\b[^>]*>\s*<g[^>]*>/g) || [];
  if (sts.length !== 2 || !sts.some(function (x) { return /idList="a1"/.test(x) && !/stroke-width/.test(x); }) || se.lineOf(edge(conv([s3])[0], 'a1')) !== '#0000FF') err.push('blue: ' + sts.join(' | '));
  console.log((err.length ? 'FAIL ' : 'ok   ') + 'an arc in a glyph\'s style' + (err.length ? ': ' + err.join('; ') : ''));
  bad += err.length ? 1 : 0;
})();
console.log(n + ' maps, ' + bad + ' failed');
process.exit(bad ? 1 : 0);
