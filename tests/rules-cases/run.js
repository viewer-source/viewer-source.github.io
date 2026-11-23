// The shared cases (make.js) against notation.js: each map read by the GraphML engine, every line asked of allowed() with
// Process Description and reduced notation on (what the converter accepts), the map's counts answered from the file.
// The base map has no refused line; each case's line "case" gets its expected answer. Called by tests/notation.js.
var fs = require('fs'), path = require('path');
module.exports = function (N, dir, ok) {
  var GE = require(path.join(__dirname, '../../renderers/converter/graphml_edit.js')), DP = require('@xmldom/xmldom').DOMParser;
  var exp = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8')), n = 0;
  function answers(file) {   // { line id: null or the reason }
    var r = GE.read(fs.readFileSync(path.join(dir, file), 'utf8'), { DOMParser: DP }), out = {};
    var word = function (n) { var l = n.el.getElementsByTagNameNS('http://www.yworks.com/xml/graphml', 'NodeLabel')[0]; return l ? l.textContent.trim() : ''; };
    var kind = function (i) { var nd = r.nodes[i]; return N.nodeKind('graphml', nd.shape.kind, word(nd)); };
    r.edges.forEach(function (e, k) {
      var a = kind(e.s), b = kind(e.t), arc = N.arcKind('graphml', e.arr[1], b && b.kind);
      var others = function (into, g) { return r.edges.filter(function (q, j) { return j !== k && (into ? q.t === g : q.s === g); }).length; };
      out[e.id] = N.allowed(arc, a, b, { sets: ['pd', 'reduced'], check: function (c) {
        if (c === 'gateOneOut') return others(false, e.s) && r.edges.slice(0, k).some(function (q) { return q.s === e.s; }) ? 'one out' : null;
        if (c === 'oneInput') return others(true, e.t) ? 'one in' : null;
        if (c === 'already') return r.edges.some(function (q, j) { return j < k && q.s === e.s && q.t === e.t && q.arr[1] === e.arr[1]; }) ? 'there' : null;
        if (c === 'tagRoom') return r.edges.some(function (q, j) { return j < k && (q.s === e.s || q.t === e.s || q.s === e.t || q.t === e.t) && (kind(q.s) || {}).kind === 'tag'; }) ? 'tag taken' : null;
        return null;
      } });
    });
    return out;
  }
  var base = answers('base.graphml');
  Object.keys(base).forEach(function (id) { n++; ok('shared case base: line ' + id + ' allowed', base[id] === null, base[id]); });
  Object.keys(exp.cases).forEach(function (c) {
    var a = answers(c + '.graphml'), got = a['case'] === null ? 'ok' : 'refused';
    n++; ok('shared case ' + c + ': ' + exp.cases[c].answer, got === exp.cases[c].answer, a['case']);
    Object.keys(a).forEach(function (id) { if (id !== 'case' && a[id] !== base[id]) { n++; ok('shared case ' + c + ': line ' + id + ' unchanged', false, a[id]); } });
  });
  return n;
};
