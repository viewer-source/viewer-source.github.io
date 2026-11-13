// Snap map to grid on a CellDesigner map, then the GraphML the editor makes again from the file drawn once more (what a
// later move, an undo and a redo draw): the file must stay the same, every connection point kept (2026-11-13: after Snap
// resized a complex, a point between the five, ENE, was written back as the nearest side, E).
//   node tests/cd-snap-redo.js [CellDesigner files or folders ...]   (default: maps/)
var fs = require('fs'), path = require('path');
var here = path.join(__dirname, '..'), DP = require('@xmldom/xmldom').DOMParser;
global.DOMParser = DP;
var ed = require(path.join(here, 'renderers/converter/cd_edit.js')), lay = require(path.join(here, 'renderers/layout/layout.js')), opt = { DOMParser: DP };
var files = [];
(process.argv.length > 2 ? process.argv.slice(2) : [path.join(here, 'maps')]).forEach(function walk(p) {
  var st = fs.statSync(p);
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules|extra)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.xml$/.test(p) && /<celldesigner:/.test(fs.readFileSync(p, 'utf8').slice(0, 4000))) files.push(p);
});
var bad = 0, n = 0;
files.forEach(function (f) {
  var base = fs.readFileSync(f, 'utf8'), r = lay.tidy(ed.graphml(base, [0, 0], opt), 'grid', [], true);
  if (r[1] <= 0) return;
  n++;
  var q1 = ed.draw(base, r[0], opt), q2 = ed.draw(base, q1[2], opt);
  if (q1[1] !== q2[1]) { bad++; console.log('different after the GraphML made again: ' + path.relative(here, f)); }
});
console.log(n + ' maps snapped: ' + (n - bad) + ' the same when drawn again from the GraphML made of the file, ' + bad + ' different');
process.exit(bad ? 1 : 0);
