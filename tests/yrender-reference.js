// yrender.js on every GraphML map against the reference set (tests/reference.js): the SVG and the refusals, in the
// three ways the renderer is used: the build (plain), the editor (classes, each node and arc in its group), the colours
// page (roles); and a fourth, the GraphML made from an SBGN-ML file (classes and sbgn: its glyphs with no fill white).
// Replaced yrender-compare.js, the comparison with the Python twin.
//   node tests/yrender-reference.js [GraphML files or folders ...]   (default: maps/)
var fs = require('fs'), path = require('path');
var here = path.join(__dirname, '..'), yr = require(path.join(here, 'renderers/yrender/yrender.js'));
var DP = require('@xmldom/xmldom').DOMParser, R = require('./reference.js').open('yrender');
var files = [];
(process.argv.length > 2 ? process.argv.slice(2) : [path.join(here, 'maps')]).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }   // a broken link
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.graphml$/.test(p)) files.push(p);
});
var WAYS = [['plain', {}], ['editor', { classes: true, groups: true }], ['roles', { roles: true }], ['sbgn', { classes: true, sbgn: true }]];
var t0 = Date.now();
files.forEach(function (f) {
  var text = fs.readFileSync(f, 'utf8'), name = path.relative(here, f);
  WAYS.forEach(function (w) {
    var got;
    try { var r = yr.render(text, Object.assign({ DOMParser: DP }, w[1])); got = r.errors.length ? r.errors.join('\n') + '\n' + r.svg : r.svg; }
    catch (e) { var nm = /^(\w+Error):/.exec(e.message); got = 'refused: ' + (nm ? nm[1] : e.name); }
    R.check(name + ' ' + w[0], text, got);
  });
});
var ok = R.end(files.length + ' maps, 4 ways (' + (Date.now() - t0) + ' ms)');
process.exit(ok ? 0 : 1);
