// Writes the shared rule cases: small yEd maps (base.graphml, and one map per case with one line added, its id "case")
// and expected.json (the answer each should get: ok, or refused with the rule). Shared with the converter, whose
// tests/rules-cases/ is a copy of these files run against its own rules (rules.py); this folder is the master. Only
// cases both rule sets should answer alike are here; where they differ, the difference is written in the viewer's notes.
//   node tests/rules-cases/make.js
var fs = require('fs'), path = require('path'), dir = __dirname;
var HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:y="http://www.yworks.com/xml/graphml">\n' +
  '  <key for="node" id="d6" yfiles.type="nodegraphics"/>\n  <key for="edge" id="d10" yfiles.type="edgegraphics"/>\n  <graph edgedefault="directed" id="G">\n';
function node(id, kind, label, x, y, w, h) {
  return '    <node id="' + id + '">\n      <data key="d6">\n        <y:GenericNode configuration="com.yworks.sbgn.' + kind + '">\n' +
    '          <y:Geometry height="' + h + '" width="' + w + '" x="' + x + '" y="' + y + '"/>\n' +
    '          <y:Fill color="#FFFFFF" transparent="false"/>\n          <y:BorderStyle color="#000000" type="line" width="1.0"/>\n' +
    '          <y:NodeLabel alignment="center" fontSize="14" modelName="custom" textColor="#000000" visible="true">' + label + '</y:NodeLabel>\n' +
    '        </y:GenericNode>\n      </data>\n    </node>\n';
}
function edge(id, s, t, head) {
  return '    <edge id="' + id + '" source="' + s + '" target="' + t + '">\n      <data key="d10">\n        <y:PolyLineEdge>\n' +
    '          <y:Path sx="0.0" sy="0.0" tx="0.0" ty="0.0"/>\n          <y:LineStyle color="#000000" type="line" width="1.0"/>\n' +
    '          <y:Arrows source="none" target="' + head + '"/>\n        </y:PolyLineEdge>\n      </data>\n    </edge>\n';
}
// a valid map: A and B into an AND gate that stimulates process P, which turns B into C; A stimulates phenotype F; T a tag of C
var NODES = node('A', 'Macromolecule', 'A', 0, 0, 80, 40) + node('B', 'SimpleChemical', 'B', 0, 200, 60, 30) +
  node('C', 'SimpleChemical', 'C', 300, 200, 60, 30) + node('P', 'Process', '', 170, 206, 18, 18) +
  node('G', 'Operator', 'AND', 170, 100, 30, 30) + node('F', 'Phenotype', 'F', 300, 0, 80, 40) + node('T', 'Tag', 'T', 450, 200, 50, 30);
var EDGES = edge('e1', 'B', 'P', 'none') + edge('e2', 'P', 'C', 'delta') + edge('e3', 'A', 'G', 'none') + edge('e4', 'B', 'G', 'none') +
  edge('e5', 'G', 'P', 'white_delta') + edge('e6', 'A', 'F', 'white_delta') + edge('e7', 'C', 'T', 'none');
var TAIL = '  </graph>\n</graphml>\n';
// [file, source, target, arrowhead, expected, the rule (viewer's id)]
var CASES = [
  ['catalysis-process', 'A', 'P', 'white_circle', 'ok', 'modulation'],
  ['catalysis-entity', 'A', 'C', 'white_circle', 'refused', 'reduced-direct'],
  ['stimulation-entity', 'A', 'C', 'white_delta', 'ok', 'reduced-direct'],
  ['inhibition-entity', 'B', 'A', 't_shape', 'ok', 'reduced-direct'],
  ['inhibition-phenotype', 'B', 'F', 't_shape', 'ok', 'modulation'],
  ['production-reversed', 'C', 'P', 'delta', 'refused', 'production'],
  ['production-second', 'P', 'A', 'delta', 'ok', 'production'],
  ['plain-entities', 'A', 'C', 'none', 'refused', 'logic-in'],
  ['logic-third-input', 'C', 'G', 'none', 'ok', 'logic-in'],
  ['modulation-from-process', 'P', 'A', 't_shape', 'refused', 'modulation'],
  ['tag-process', 'T', 'P', 'none', 'refused', 'tag']
];
fs.writeFileSync(path.join(dir, 'base.graphml'), HEAD + NODES + EDGES + TAIL);
var exp = { _: 'The answer each case should get: the line "case" added to base.graphml. Master: the viewer’s tests/rules-cases (make.js); the converter keeps a copy.', base: 'ok', cases: {} };
CASES.forEach(function (c) {
  fs.writeFileSync(path.join(dir, c[0] + '.graphml'), HEAD + NODES + EDGES + edge('case', c[1], c[2], c[3]) + TAIL);
  exp.cases[c[0]] = { answer: c[4], rule: c[5] };
});
fs.writeFileSync(path.join(dir, 'expected.json'), JSON.stringify(exp, null, 1) + '\n');
console.log(CASES.length + ' cases written');
