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
var get = function (s, k) { var r = new RegExp('\\s' + k + '\\s*=\\s*"([^"]*)"').exec(s); return r ? r[1] : null; };
var set = function (s, k, v) {
  var r = new RegExp('(\\s' + k + '\\s*=\\s*")[^"]*"');
  return v == null ? s.replace(new RegExp('\\s' + k + '\\s*=\\s*"[^"]*"'), '') : r.test(s) ? s.replace(r, '$1' + v + '"') : s.replace(/(\/?>)$/, ' ' + k + '="' + v + '"$1');
};
function swap(g, a, b, into) {   // as the editor's swapMain
  var att = into ? 'source' : 'target', xy = into ? ['sx', 'sy'] : ['tx', 'ty'];
  var blk = function (id) { var i = g.indexOf('<edge id="' + id + '"'); return g.slice(i, g.indexOf('</edge>', i) + 7); };
  var A = blk(a), B = blk(b), path = function (x) { return /<y:Path\b[^>]*?(\/>|>[\s\S]*?<\/y:Path>)/.exec(x)[0]; };
  var head = function (p) { return /^<y:Path\b[^>]*>/.exec(p)[0]; }, pts = function (p) { return p.replace(/^<y:Path\b[^>]*?(\/>|>)/, '').replace(/<\/y:Path>$/, ''); };
  var pa = path(A), pb = path(B), tA = /^<edge\b[^>]*>/.exec(A)[0], tB = /^<edge\b[^>]*>/.exec(B)[0];
  var mk = function (p, from, body) { var h = head(p).replace(/\/>$/, '>'); xy.forEach(function (k) { h = set(h, k, get(head(from), k)); }); return body.trim() ? h + body + '</y:Path>' : h.replace(/>$/, '/>'); };
  var A2 = A.replace(tA, set(tA, att, get(tB, att))).replace(pa, mk(pa, pb, pts(pb)));
  var B2 = B.replace(tB, set(tB, att, get(tA, att))).replace(pb, mk(pb, pa, pts(pa)));
  return g.replace(A, A2).replace(B, B2);
}
function edges(g) { var E = {}; (g.match(/<edge id="[^"]*" source="[^"]*" target="[^"]*"/g) || []).forEach(function (s) { var m = /id="([^"]*)" source="([^"]*)" target="([^"]*)"/.exec(s); E[m[1]] = [m[2], m[3]]; }); return E; }
var jobs = [];
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8'), g = ed.graphml(t, null, opt), E = edges(g);
  Object.keys(E).forEach(function (id) {
    var m = /^(.*\|)([rp])(\d+)$/.exec(id);
    if (!m) return;
    var into = m[2] === 'r', main = m[1] + (into ? 'a' : 'b');
    if (!E[main]) return;
    jobs.push({ f: f, t: t, g0: g, into: into, main: main, link: id, j: into ? 0 : 1, g1: swap(g, main, id, into) });
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
    if (!E1[j.main] || E1[j.main][j.j] !== E0[j.link][j.j]) msg.push('main line not at the added species');
    if (!E1[j.link] || E1[j.link][j.j] !== E0[j.main][j.j]) msg.push('added line not at the old main species');
    Object.keys(E0).forEach(function (e) { if (e !== j.main && e !== j.link && (!E1[e] || E1[e].join() !== E0[e].join())) msg.push('other line ' + e + ' changed'); });
    var rid = j.main.split('|')[0], body = function (tt) { var i = tt.search(new RegExp('<reaction [^>]*\\bid="' + rid + '"')); return tt.slice(i, tt.indexOf('</reaction>', i)); };
    var refs = function (tt) { return (body(tt).match(/<speciesReference [^>]*species="[^"]*"/g) || []).map(function (s) { return get(s, 'species'); }).sort().join(); };
    if (refs(out) !== refs(j.t)) msg.push('SBML references changed: ' + refs(j.t) + ' -> ' + refs(out));
    // swapped back gives the file as it was
    try { var back = ed.apply(out, swap(ed.graphml(out, null, opt), j.main, j.link, j.into), opt); if (edges(ed.graphml(back, null, opt))[j.main].join() !== E0[j.main].join()) msg.push('swapping back does not restore the main line'); } catch (e) { msg.push('back: ' + e.message); }
  }
  if (msg.length) { bad++; console.log('DIFF', tag, '|', msg.slice(0, 4).join(' | ')); } else if (process.env.VERBOSE) console.log('ok  ', tag);
});
console.log(jobs.length + ' swaps on ' + files.length + ' maps: ' + (bad ? bad + ' wrong' : 'all right'));
process.exit(bad ? 1 : 0);
