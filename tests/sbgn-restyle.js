// sbgn_edit's restyle (the editor's Properties, 2026-11-14) on SBGN-ML files of every render-extension shape, against the
// converter: a macromolecule made on an empty <map/>, and a file's own macromolecule given a fill, a border colour and a
// width, in a file with no extension, with an extension holding other things, with colour definitions but no styles, with
// the glyph named in two styles (the font family of the first kept), with libsbgn's prefixed attributes. Checks: the
// converter reads the look written; graphml(s2, conv(s)) is conv(s2) byte for byte (drawn the same for the glyph made); write(s2, conv(s2)) is s2.
//   node tests/sbgn-restyle.js [python]
var path = require('path'), cp = require('child_process'), here = path.join(__dirname, '..');
var se = require(path.join(here, 'renderers/converter/sbgn_edit.js')), DP = require('@xmldom/xmldom').DOMParser, opt = { DOMParser: DP };
var py = process.argv[2] || 'python3', yr = require(path.join(here, 'renderers/yrender/yrender.js'));
function draw(g) { return yr.render(g, opt).svg; }
var DRIVER = ['import sys, json, contextlib, io, tempfile, os', 'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']',
  'from mapconv import sbgnml, graphml, report', 'out = []',
  'for t in json.load(sys.stdin):',
  '    f = tempfile.NamedTemporaryFile("w", suffix=".sbgn", delete=False); f.write(t); f.close()',
  '    try:',
  '        with report.collect(), contextlib.redirect_stdout(io.StringIO()): out.append(graphml.write(sbgnml.read(f.name)))',
  '    except Exception as e: out.append("ERROR " + str(e))',
  '    os.unlink(f.name)',
  'json.dump(out, sys.stdout)'].join('\n');
function conv(ts) { return JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(ts), maxBuffer: 1 << 30 }).toString()); }
var R = 'http://www.sbml.org/sbml/level3/version1/render/version1', G1 = '\n    <glyph class="macromolecule" id="g1">\n      <label text="A"/>\n      <bbox x="10" y="10" w="80" h="40"/>\n    </glyph>';
function file(ext, glyphs, pre) { return '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3"' + (pre ? ' xmlns:ns1="' + R + '"' : '') + '>\n  <map language="process description">' + ext + glyphs + '\n  </map>\n</sbgn>\n'; }
var cases = [
  ['no extension', file('', G1)],
  ['an extension with other things', file('\n    <extension><other/></extension>', G1)],
  ['colour definitions, no styles', file('\n    <extension>\n      <renderInformation xmlns="' + R + '" id="ri">\n        <listOfColorDefinitions>\n          <colorDefinition id="c1" value="#ffcc00"/>\n        </listOfColorDefinitions>\n      </renderInformation>\n    </extension>', G1)],
  ['two styles', file('\n    <extension>\n      <renderInformation xmlns="' + R + '" id="ri">\n        <listOfColorDefinitions>\n          <colorDefinition id="c1" value="#c2d4ed"/>\n        </listOfColorDefinitions>\n        <listOfStyles>\n          <style id="s1" idList="g1"><g fill="c1" font-family="Helvetica"/></style>\n          <style id="s2" idList="g1"><g font-size="12" stroke="#000000"/></style>\n        </listOfStyles>\n      </renderInformation>\n    </extension>', G1)],
  ['prefixed', file('\n    <extension>\n      <ns1:renderInformation ns1:id="ri">\n        <ns1:listOfColorDefinitions>\n          <ns1:colorDefinition ns1:id="c1" ns1:value="#c2d4ed"/>\n        </ns1:listOfColorDefinitions>\n        <ns1:listOfStyles>\n          <ns1:style ns1:idList="g1"><ns1:g ns1:fill="c1"/></ns1:style>\n        </ns1:listOfStyles>\n      </ns1:renderInformation>\n    </extension>', G1, true)],
  ['an empty map', '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3">\n  <map language="process description"/>\n</sbgn>\n']
];
var base = conv(cases.map(function (c) { return c[1]; })), s2s = [], bad = 0;
cases.forEach(function (c, k) {
  var g = base[k], g2;
  if (c[0] === 'an empty map') g2 = se.add(g, { id: 'm1', cls: 'macromolecule', label: 'M', box: [10, 10, 80, 40], fill: '#FFCC00', line: '#AA0000', width: 2.5, font: 14 }, opt);
  else g2 = se.restyle(g, 'g1', { fill: '#FFCC00', line: '#AA0000', width: 2.5 }, opt);
  s2s.push(se.write(c[1], g2, opt));
});
var after = conv(s2s);
cases.forEach(function (c, k) {
  var why = [], s2 = s2s[k], c2 = after[k], id = c[0] === 'an empty map' ? 'm1' : 'g1';
  if (/^ERROR/.test(c2)) why.push('the converter cannot read the file written: ' + c2);
  else {
    var doc = new DP().parseFromString(c2, 'application/xml'), n = Array.prototype.filter.call(doc.getElementsByTagName('node'), function (x) { return x.getAttribute('id') === id; })[0];
    var fl = n && n.getElementsByTagName('y:Fill')[0], bs = n && n.getElementsByTagName('y:BorderStyle')[0];
    if (!fl || fl.getAttribute('color') !== '#FFCC00' || bs.getAttribute('color') !== '#AA0000' || bs.getAttribute('width') !== '2.5') why.push('the converter reads another look');
    var re = se.graphml(s2, base[k], opt);   // a glyph made is drawn the same (made()); a restyled one byte for byte
    if (c[0] === 'an empty map' ? draw(re) !== draw(c2) : re !== c2) why.push('graphml(s2, conv(s)) is not conv(s2)');
    if (se.write(s2, c2, opt) !== s2) why.push('write(s2, conv(s2)) is not s2');
  }
  if (c[0] === 'two styles' && !/font-family="Helvetica"/.test(s2)) why.push('the first style\'s font family lost');
  if ((s2.match(/renderInformation [^>]*id=/g) || []).length > 1) why.push('a second render information');
  if (why.length) { bad++; console.log('DIFFERENT ' + c[0] + ': ' + why.join('; ')); }
});
console.log(cases.length + ' render-extension shapes restyled: ' + (bad ? bad + ' different' : 'all right'));
process.exit(bad ? 1 : 0);
