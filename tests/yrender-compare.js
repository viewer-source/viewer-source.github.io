// yrender.py and yrender.js on the same maps: the SVG and the refusals must be the same, byte for byte, in the three
// ways the renderer is used: the build (plain), the editor (classes, each node and arc in its group), the colours page
// (roles). Python is the master until the switch (user's yes).
//   node tests/yrender-compare.js [python] [GraphML files or folders ...]   (default: python3, maps/)
// Needs lxml for that Python and @xmldom/xmldom for Node (npm i @xmldom/xmldom).
var fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), yr = require(path.join(here, 'renderers/yrender/yrender.js'));
var DP = require('@xmldom/xmldom').DOMParser;
var args = process.argv.slice(2), py = args[0] && !/graphml$|\//.test(args[0]) && !fs.existsSync(args[0]) ? args.shift() : 'python3';
var files = [];
(args.length ? args : [path.join(here, 'maps')]).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }   // a broken link
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.graphml$/.test(p)) files.push(p);
});
var DRIVER = [   // the editor's way of calling yrender.py (each node and arc in a group), as editor/src/graphml.js did
  'import sys, json, html as _h',
  "sys.path.insert(0, " + JSON.stringify(path.join(here, 'renderers/yrender')) + ")",
  'import yrender',
  '_node, _edge = yrender.Map.read_node, yrender.Map.edge_svg',
  'def read_node(self, node, parent):',
  '    _node(self, node, parent)',
  "    n = self.nodes.get(node.get('id'))",
  "    if n and not n.get('wrapped'): n['svg'] = '<g data-n=\"' + _h.escape(node.get('id')) + '\">' + n['svg'] + '</g>'; n['wrapped'] = True",
  'def edge_svg(self, e, parent):',
  '    s = _edge(self, e, parent)',
  "    return '<g data-e=\"' + _h.escape(e.get('id') or '') + '\">' + s + '</g>' if s else s",
  'out = []',
  'for f in json.load(sys.stdin):',
  '    row = {}',
  "    for way in ('plain', 'editor', 'roles'):",
  '        yrender.errors.clear(); yrender.ROLES = way == "roles"; yrender.CLASSES = way == "editor"',
  "        yrender.Map.read_node, yrender.Map.edge_svg = (read_node, edge_svg) if way == 'editor' else (_node, _edge)",
  '        try: row[way] = [yrender.Map(f).svg(), list(yrender.errors)]',
  "        except Exception as e: row[way] = [None, [type(e).__name__]]",
  '    out.append(row)',
  'print(json.dumps(out))'].join('\n');
var t0 = Date.now();
var ref = JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(files), maxBuffer: 1 << 30 }).toString());
var tPy = Date.now() - t0, tJs = 0, bad = 0, first = null;
files.forEach(function (f, i) {
  var text = fs.readFileSync(f, 'utf8');
  [['plain', {}], ['editor', { classes: true, groups: true }], ['roles', { roles: true }]].forEach(function (w) {
    var t1 = Date.now(), got;
    try { var r = yr.render(text, Object.assign({ DOMParser: DP }, w[1])); got = [r.svg, r.errors]; }
    catch (e) { var nm = /^(\w+Error):/.exec(e.message); got = [null, [nm ? nm[1] : e.name]]; }
    tJs += Date.now() - t1;
    var want = ref[i][w[0]];
    if (want[0] === null && got[0] === null) return;   // both cannot draw it (not a map: the error's name may differ)
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      bad++;
      if (!first) {
        var a = (want[0] || '').split('\n'), b = (got[0] || '').split('\n'), k = 0;
        while (k < a.length && a[k] === b[k]) k++;
        first = path.relative(here, f) + ' (' + w[0] + ')\n  python: ' + (a[k] || JSON.stringify(want[1])).slice(0, 400) + '\n  js:     ' + (b[k] || JSON.stringify(got[1])).slice(0, 400);
      }
      console.log('differs: ' + path.relative(here, f) + ' (' + w[0] + ')' + (want[0] === null || got[0] === null ? ' python ' + JSON.stringify(want[1]) + ' js ' + JSON.stringify(got[1]) : ''));
    }
  });
});
console.log(files.length + ' maps, 3 ways: ' + (files.length * 3 - bad) + ' the same, ' + bad + ' different; python ' + tPy + ' ms (with its start), js ' + tJs + ' ms');
if (first) console.log('first difference: ' + first);
process.exit(bad ? 1 : 0);
