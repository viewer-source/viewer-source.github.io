// Make main (user, 2026-11-14): on every CellDesigner map, every reaction with an added reactant or product has it
// swapped with the main one, as the editor's right-click Make main writes cd_edit's GraphML (the two edges trade their
// species end, their port there and their bend points). Checked: cd_edit.js and cd_edit.py write the same text byte for
// byte; the base reactant or product now names the added one's species and alias and the link the old main one's; the
// SBML references still list both species; the GraphML made again has the two lines swapped and every other line as
// before; the text reads as XML.
//   node tests/cd-make-main.js [python] [CellDesigner files or folders ...]   (default: python3, maps/)
var fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), ed = require(path.join(here, 'renderers/converter/cd_edit.js'));
var DP = require('@xmldom/xmldom').DOMParser, opt = { DOMParser: DP };
var args = process.argv.slice(2), py = args[0] && !/\.xml$|\//.test(args[0]) && !fs.existsSync(args[0]) ? args.shift() : 'python3';
var files = [];
(args.length ? args : [path.join(here, 'maps')]).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.xml$/.test(p)) { var t = fs.readFileSync(p, 'utf8').slice(0, 3000); if (/<sbml[\s>]/.test(t) && t.indexOf('celldesigner') >= 0) files.push(p); }
});
function edges(g) {   // id -> [source, target, port at the source, port at the target, bend points]
  var E = {}, re = /<edge\b[\s\S]*?<\/edge>/g, b;
  while ((b = re.exec(g))) {
    var t = /^<edge\b[^>]*>/.exec(b[0])[0], a = function (s, k) { var m = new RegExp('\\s' + k + '="([^"]*)"').exec(s); return m ? m[1] : null; };
    var p = /<y:Path\b[^>]*>/.exec(b[0]), ph = p ? p[0] : '', pts = (b[0].match(/<y:Point [^>]*>/g) || []).map(function (q) { return [+a(q, 'x'), +a(q, 'y')]; });
    E[a(t, 'id')] = [a(t, 'source'), a(t, 'target'), [+a(ph, 'sx') || 0, +a(ph, 'sy') || 0], [+a(ph, 'tx') || 0, +a(ph, 'ty') || 0], pts];
  }
  return E;
}
var jobs = [], refused = [];
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8'), g = ed.graphml(t, null, opt), E = edges(g);
  Object.keys(E).forEach(function (id) {
    var m = /^(.*\|)([rp])(\d+)$/.exec(id);
    if (!m) return;
    var into = m[2] === 'r', main = m[1] + (into ? 'a' : 'b');
    if (!E[main]) return;
    var g1 = ed.makeMain(g, id);
    if (g1) jobs.push({ f: f, t: t, g0: g, into: into, main: main, link: id, j: into ? 0 : 1, g1: g1 });
    else refused.push(path.basename(f) + ' ' + id);
  });
});
var DRIVER = ['import sys, json', 'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']', 'import cd_edit', 'out = []',
  'for t, g in json.load(sys.stdin):', '    try: out.append(cd_edit.apply(t, g))', '    except Exception as e: out.append("ERR " + repr(e))', 'json.dump(out, sys.stdout)'].join('\n');
var pyOut = JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(jobs.map(function (j) { return [j.t, j.g1]; })), maxBuffer: 1 << 30 }).toString());
var bad = 0;
jobs.forEach(function (j, n) {
  var tag = path.basename(j.f) + ' ' + j.link + ' made main', msg = [], out;
  try { out = ed.apply(j.t, j.g1, opt); } catch (e) { msg.push('JavaScript: ' + (e && e.message || e)); }
  if (out !== undefined && out !== pyOut[n]) msg.push('JavaScript and Python differ' + (/^ERR/.test(pyOut[n]) ? ' (' + pyOut[n] + ')' : ''));
  if (out !== undefined) {
    new DP({ onError: function (l, m) { if (l !== 'warning') msg.push('XML: ' + m); } }).parseFromString(out, 'application/xml');
    var E0 = edges(j.g0), E1 = edges(ed.graphml(out, null, opt));
    var same = function (p, q) { return Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.6; }, P = j.j + 2;
    if (!E1[j.main] || E1[j.main][j.j] !== E0[j.link][j.j]) msg.push('main line not at the added species');
    if (!E1[j.link] || E1[j.link][j.j] !== E0[j.main][j.j]) msg.push('added line not at the old main species');
    // each species keeps its line's port (CellDesigner's 16 anchors) and bend points
    if (E1[j.main] && !same(E1[j.main][P], E0[j.link][P])) msg.push('port at the new main species moved: ' + E0[j.link][P] + ' -> ' + E1[j.main][P]);
    if (E1[j.link] && !same(E1[j.link][P], E0[j.main][P])) msg.push('port at the old main species moved: ' + E0[j.main][P] + ' -> ' + E1[j.link][P]);
    if (E1[j.main] && E1[j.main][4].length !== E0[j.link][4].length) msg.push('bend points of the new main line: ' + E0[j.link][4].length + ' -> ' + E1[j.main][4].length);
    Object.keys(E0).forEach(function (e) { if (e !== j.main && e !== j.link && (!E1[e] || E1[e].slice(0, 2).join() !== E0[e].slice(0, 2).join())) msg.push('other line ' + e + ' changed'); });
    var rid = j.main.split('|')[0], body = function (tt) { var i = tt.search(new RegExp('<reaction [^>]*\\bid="' + rid + '"')); return tt.slice(i, tt.indexOf('</reaction>', i)); };
    var refs = function (tt) { return (body(tt).match(/<speciesReference [^>]*species="[^"]*"/g) || []).map(function (s) { return /species="([^"]*)"/.exec(s)[1]; }).sort().join(); };
    if (refs(out) !== refs(j.t)) msg.push('SBML references changed: ' + refs(j.t) + ' -> ' + refs(out));
    // swapped back gives the file as it was
    try { var back = ed.apply(out, ed.makeMain(ed.graphml(out, null, opt), j.link), opt), E2 = edges(ed.graphml(back, null, opt)); if ([j.main, j.link].some(function (e) { return E2[e].slice(0, 2).join() !== E0[e].slice(0, 2).join(); })) msg.push('swapping back does not restore the lines'); } catch (e) { msg.push('back: ' + e.message); }
  }
  if (msg.length) { bad++; console.log('DIFF', tag, '|', msg.slice(0, 4).join(' | ')); } else if (process.env.VERBOSE) console.log('ok  ', tag);
});
// refused: an added reactant whose species is also a product of the reaction (the swap would be half done)
var t0 = fs.readFileSync(path.join(here, 'maps/acly-celldesigner.xml'), 'utf8'), g0 = ed.graphml(t0, null, opt), E0 = edges(g0);
var r0 = Object.keys(E0).filter(function (e) { return /\|r0$/.test(e); })[0], p0 = r0 && r0.replace(/r0$/, 'p0');
if (r0 && E0[p0]) {
  var g2 = g0.replace(new RegExp('(<edge id="' + p0.replace(/\|/g, '\\|') + '" source="[^"]*" target=")[^"]*"'), '$1' + E0[r0][0] + '"');
  if (ed.makeMain(g2, r0) !== null) { bad++; console.log('DIFF makeMain offered on a species that is also a product'); }
}
console.log(jobs.length + ' swaps on ' + files.length + ' maps (' + refused.length + ' not offered): ' + (bad ? bad + ' wrong' : 'all right'));
process.exit(bad ? 1 : 0);
