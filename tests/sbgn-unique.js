// sbgn_edit.unique against sbgnml.read: a file with two glyphs of one id, made unique by the editor, reads the same
// (the same nodes under the same ids with their fills, every arc at the same ends) as the file read as it was; a second pass changes
// nothing; a file without shared ids is returned as it is.
//   node tests/sbgn-unique.js [python] [SBGN-ML files ...]   (default: python3 and a made-up case)
var fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
var here = path.join(__dirname, '..'), se = require(path.join(here, 'renderers/converter/sbgn_edit.js'));
var DP = require('@xmldom/xmldom').DOMParser, opt = { DOMParser: DP };
var py0 = process.argv[2] && !/\.sbgn$/.test(process.argv[2]) ? process.argv[2] : 'python3';
var files = process.argv.slice(2).filter(function (a) { return /\.sbgn$/.test(a); });
var CASE = '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.2"><map language="process description">\n' +
  '  <glyph class="association" id="g1"><bbox x="218" y="58" w="24" h="24"/><port id="g1.1" x="206" y="70"/><port id="g1.2" x="254" y="70"/></glyph>\n' +
  '  <glyph class="macromolecule" id="g1"><label text="myosin"/><bbox x="0" y="40" w="108" h="60"/></glyph>\n' +
  '  <glyph class="macromolecule" id="g1_2"><label text="taken"/><bbox x="0" y="300" w="108" h="60"/></glyph>\n' +
  '  <glyph class="complex" id="cx"><label text="c"/><bbox x="400" y="40" w="80" h="60"/></glyph>\n' +
  '  <glyph class="process" id="p"><bbox x="40" y="200" w="20" h="20"/><port id="p.1" x="30" y="210"/><port id="p.2" x="70" y="210"/></glyph>\n' +
  '  <arc class="consumption" id="a1" source="g1" target="g1.1"><start x="108" y="70"/><end x="206" y="70"/></arc>\n' +
  '  <arc class="production" id="a3" source="g1.2" target="cx"><start x="254" y="70"/><end x="400" y="70"/></arc>\n' +
  '  <arc class="production" id="a4" source="p.2" target="g1"><start x="70" y="210"/><end x="54" y="100"/></arc>\n' +
  '</map></sbgn>\n';
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbgn-unique-')), bad = 0, n = 0;
function py(t, name, what) {   // what: 'read' (nodes with kind, label, fill; arcs with their ends) or 'graphml' (the build's)
  var f = path.join(tmp, name + '.sbgn'); fs.writeFileSync(f, t);
  var code = 'import sys, json, contextlib, io\nfrom mapconv import sbgnml, graphml\nwith contextlib.redirect_stdout(io.StringIO()):\n    m = sbgnml.read(sys.argv[1])\n' +
    'print(graphml.write(m) if sys.argv[2] == "graphml" else json.dumps([sorted((i, n.kind, n.labels[0], n.fill) for i, n in m.nodes.items()), sorted((a.id, a.source, a.target) for a in m.arcs)]))';
  return cp.execFileSync(py0, ['-c', code, f, what], { env: Object.assign({}, process.env, { PYTHONPATH: path.join(here, 'renderers/converter') }) }).toString();
}
function check(t, name) {
  n++;
  var g0 = py(t, name + '-g0', 'graphml'), u = se.unique(t, g0, opt), why = [];
  if (se.unique(u, g0, opt) !== u) why.push('a second pass changed the file');
  if (py(t, name + '-as-is', 'read') !== py(u, name + '-unique', 'read')) why.push('read differently once made unique');
  if (new DP().parseFromString(u, 'application/xml').getElementsByTagName('parsererror').length) why.push('not readable XML');
  if (why.length) { bad++; console.log(name + ': ' + why.join(', ')); } else console.log(name + ': ok');
}
check(CASE, 'made-up');
check(CASE.replace(/<glyph class="macromolecule" id="g1">/, '<glyph class="macromolecule" id="m">').replace(/source="g1" target="g1.1"/, 'source="m" target="g1.1"').replace(/target="g1">/, 'target="m">'), 'no-shared-ids');
files.forEach(function (f) { check(fs.readFileSync(f, 'utf8'), path.basename(f, '.sbgn')); });
var none = se.unique(CASE.replace(/id="g1">(<label text="myosin")/, 'id="m">$1'), null, opt);
if (none !== CASE.replace(/id="g1">(<label text="myosin")/, 'id="m">$1')) { bad++; console.log('unchanged file: changed'); }
fs.rmSync(tmp, { recursive: true, force: true });
console.log(bad ? bad + ' of ' + n + ' failed' : 'all ok (' + n + ')');
process.exit(bad ? 1 : 0);
