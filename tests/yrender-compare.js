// yrender.js against the previous release (tests/compare.js) on the test set's GraphML maps and SBGN-ML maps (read into
// GraphML by the converter's copy, as the build does), in the ways the renderer is used: the build (plain), the editor
// (classes, each node and arc in its group), the colours page (roles), and a GraphML made from an SBGN-ML file (classes
// and sbgn: its glyphs with no fill white).
//   BASE=<earlier release> node tests/yrender-compare.js [python] [map files or folders ...]   (python: the converter's)
var fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), yr = require(path.join(here, 'renderers/yrender/yrender.js'));
var DP = require('@xmldom/xmldom').DOMParser, C = require('./compare.js').open('yrender'), yb = C.base('renderers/yrender/yrender.js');
var args = process.argv.slice(2), py = args[0] && !/\.(graphml|sbgn|nwt)$|\//.test(args[0]) && !fs.existsSync(args[0]) ? args.shift() : 'python3';
var files = C.files(args, function (p) { return /\.(graphml|sbgn|nwt)$/.test(p); });
var SB = files.filter(function (f) { return !/\.graphml$/.test(f); });
var DRIVER = ['import sys, json, contextlib, io', 'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']',
  'from mapconv import sbgnml, graphml, report', 'out = []', 'for f in json.load(sys.stdin):', '    try:',
  '        with report.collect(), contextlib.redirect_stdout(io.StringIO()): out.append(graphml.write(sbgnml.read(f)))',
  '    except Exception as e: out.append(None)', 'json.dump(out, sys.stdout)'].join('\n');
var conv = SB.length ? JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(SB), maxBuffer: 1 << 30 }).toString()) : [];
function draw(r, text, o) {
  try { var d = r.render(text, Object.assign({ DOMParser: DP }, o)); return d.errors.length ? d.errors.join('\n') + '\n' + d.svg : d.svg; }
  catch (e) { var nm = /^(\w+Error):/.exec(e.message); return 'refused: ' + (nm ? nm[1] : e.name); }
}
var WAYS = [['plain', {}], ['editor', { classes: true, groups: true }], ['roles', { roles: true }], ['sbgn', { classes: true, sbgn: true }]];
var t0 = Date.now(), n = 0;
files.forEach(function (f) {
  var text = /\.graphml$/.test(f) ? fs.readFileSync(f, 'utf8') : conv[SB.indexOf(f)], name = path.relative(here, f);
  if (!text) return console.log('not read by the converter: ' + name);
  n++;
  (/\.graphml$/.test(f) ? WAYS : WAYS.filter(function (w) { return w[0] === 'sbgn'; })).forEach(function (w) {
    C.check(name + ' ' + w[0], draw(yr, text, w[1]), yb && draw(yb, text, w[1]));
  });
});
process.exit(C.end(n + ' maps (' + SB.length + ' SBGN-ML), ' + (Date.now() - t0) + ' ms') ? 0 : 1);
