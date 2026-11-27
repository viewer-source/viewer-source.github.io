// sbgn_edit.membersOut, the editor's correction on opening of lines at a complex's members, against its master, the
// converter's rules.joined: for every SBGN-ML file under the folders given, and for the cases below (also as yEd
// GraphML, written by the converter from them), the map read from the corrected text means what the converter's
// corrected reading of the original means (check.meaning); a file with no such line comes back byte for byte.
//   node tests/member-arcs.js <the converter's repository> [<folder or file> ...]
var fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
var here = path.join(__dirname, '..'), se = require(path.join(here, 'renderers/converter/sbgn_edit.js'));
var DP = require('@xmldom/xmldom').DOMParser;
var args = process.argv.slice(2), conv = args.shift();
if (!conv) { console.log('usage: node tests/member-arcs.js <the converter\'s repository> [<folder or file> ...]'); process.exit(2); }
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'member-arcs-')), files = [];
var CASES = {   // two members of one complex, a member and a member of another complex, a member repeating its complex's line
  'members.sbgn': '<sbgn xmlns="http://sbgn.org/libsbgn/0.3"><map id="m" language="process description">\n' +
    '  <glyph id="ab" class="complex"><label text="AB"/><bbox x="0" y="0" w="200" h="80"/>\n' +
    '    <glyph id="a" class="macromolecule"><label text="A"/><bbox x="10" y="20" w="60" h="40"/></glyph>\n' +
    '    <glyph id="b" class="macromolecule"><label text="B"/><bbox x="120" y="20" w="60" h="40"/></glyph></glyph>\n' +
    '  <glyph id="cd" class="complex"><label text="CD"/><bbox x="0" y="200" w="200" h="80"/>\n' +
    '    <glyph id="c" class="macromolecule"><label text="C"/><bbox x="10" y="220" w="60" h="40"/></glyph></glyph>\n' +
    '  <glyph id="x" class="macromolecule"><label text="X"/><bbox x="300" y="100" w="60" h="40"/></glyph>\n' +
    '  <arc id="e1" class="stimulation" source="a" target="b"><start x="70" y="40"/><end x="120" y="40"/></arc>\n' +
    '  <arc id="e2" class="stimulation" source="a" target="c"><start x="40" y="60"/><end x="40" y="220"/></arc>\n' +
    '  <arc id="e3" class="inhibition" source="ab" target="x"><start x="200" y="40"/><end x="300" y="120"/></arc>\n' +
    '  <arc id="e4" class="inhibition" source="b" target="x"><start x="180" y="40"/><end x="300" y="110"/></arc>\n' +
    '</map></sbgn>\n'
};
Object.keys(CASES).forEach(function (n) { var f = path.join(tmp, n); fs.writeFileSync(f, CASES[n]); files.push(f); });
(function walk(list) { list.forEach(function (p) { var s = fs.statSync(p); if (s.isDirectory()) walk(fs.readdirSync(p).sort().map(function (f) { return path.join(p, f); })); else if (/\.(sbgn|nwt)$/i.test(p)) files.push(p); }); })(args);
// the cases as yEd GraphML too, as the converter writes them (its lines at members as drawn, not joined)
var py = function (code, input) { var r = cp.spawnSync('python3', ['-c', code, conv], { input: input, maxBuffer: 1 << 30, encoding: 'utf8' }); if (r.status) { console.log(r.stderr); process.exit(2); } return r.stdout; };
Object.keys(CASES).forEach(function (n) {
  var g = path.join(tmp, n.replace(/\.sbgn$/, '.graphml'));
  fs.writeFileSync(g, py('import sys, io, contextlib\nsys.path.insert(0, sys.argv[1])\nfrom mapconv import graphml, sbgnml, report\nwith report.collect(), contextlib.redirect_stdout(io.StringIO()):\n    print(graphml.write(sbgnml.read(sys.stdin.read().strip())), file=sys.__stdout__)', path.join(tmp, n)));
  files.push(g);
});
var bad = 0, changed = 0, same = 0, pairs = [];
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8'), r;
  try { r = se.membersOut(t, { DOMParser: DP }); } catch (e) { console.log('FAIL  ' + f + ': ' + e.message); bad++; return; }
  if (!r.said.length && f.indexOf(tmp) === 0) { console.log('FAIL  ' + f + ': a case with lines at members left as it was'); bad++; return; }
  if (!r.said.length) { if (r.text !== t) { console.log('FAIL  ' + f + ': changed with nothing said'); bad++; } else same++; return; }
  changed++;
  var out = path.join(tmp, 'fixed-' + changed + path.extname(f));
  fs.writeFileSync(out, r.text);
  pairs.push([f, out, r.said]);
});
// the converter: its corrected reading of the original against its reading of the editor's text
var res = JSON.parse(py([
  'import sys, json, io, contextlib',
  'sys.path.insert(0, sys.argv[1])',
  'from mapconv import check, graphml, sbgnml, rules, report',
  'rd = lambda f: graphml.read(f) if f.endswith(".graphml") else sbgnml.read(f)',
  'out = []',
  'for a, b in json.loads(sys.stdin.read()):',
  '    with report.collect(), contextlib.redirect_stdout(io.StringIO()):',
  '        x, y = check.meaning(rules.joined(rd(a))), check.meaning(rd(b))',
  '    out.append([sorted(map(repr, (x[0] - y[0]) + (x[1] - y[1]))), sorted(map(repr, (y[0] - x[0]) + (y[1] - x[1])))])',
  'print(json.dumps(out))'].join('\n'), JSON.stringify(pairs.map(function (p) { return [p[0], p[1]]; }))));
pairs.forEach(function (p, i) {
  var d = res[i];
  if (d[0].length || d[1].length) { console.log('FAIL  ' + p[0] + ': meaning differs from the converter\'s\n  converter only: ' + d[0].join('; ') + '\n  editor only: ' + d[1].join('; ')); bad++; }
  else console.log('ok    ' + path.basename(p[0]) + ': ' + p[2].join('; '));
});
console.log(files.length + ' files: ' + changed + ' corrected as the converter does, ' + same + ' unchanged, ' + bad + ' wrong');
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
