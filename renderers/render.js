// The build's renderers in JavaScript (the master for the viewer's own build and the
// editor): build.py starts this once and asks it, one line of JSON per map, for a drawing; it answers one line each.
//   {"kind":"yed","src":path,"sbgn":true}  -> {"svg":...,"errors":[...]}   (yrender.js, classes on; sbgn: a GraphML made from SBGN-ML)
//   {"kind":"cd","src":path}   -> {"svg":...,"hits":{...}}     (cdrender.js, classes on, with the click data)
//   either with "groups":true  -> the same, each node and line in a group of its own (data-n, data-e): the published
//                                 picture is this drawing, which the editor takes as its own on entering edit (no redraw),
//                                 and the build reads the lines a click lights from it
//   anything that fails           -> {"error": message}
// A CellDesigner map whose compartments name a picture in their notes ('Glyph: glyphs/x.png', MINERVA's way) gets the
// picture drawn in the compartment's box when that file is beside the map, embedded as a data address; without the file
// the compartment is drawn as lines.
// Needs @xmldom/xmldom (npm install in the repository, or NODE_PATH).
var fs = require('fs'), path = require('path'), readline = require('readline');
var DP = require('@xmldom/xmldom').DOMParser;
var yr = require(path.join(__dirname, 'yrender', 'yrender.js')), cd = require(path.join(__dirname, 'converter', 'cdrender.js'));
var log = function (s) { process.stderr.write(s + '\n'); };
function glyphs(src) {
  return function (rel) {
    var dir = path.dirname(path.resolve(src)), f = path.resolve(dir, rel), up = path.relative(dir, f);
    if (path.isAbsolute(rel) || up.split(path.sep)[0] === '..' || !/\.png$/i.test(f) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return null;   // only a PNG file in the map's own folder
    return 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
  };
}
readline.createInterface({ input: process.stdin }).on('line', function (line) {
  var out;
  try {
    var job = JSON.parse(line), text = fs.readFileSync(job.src, 'utf8');
    var g = !!job.groups;
    if (job.kind === 'yed') { var r = yr.render(text, { classes: true, groups: g, sbgn: !!job.sbgn, DOMParser: DP }); out = { svg: r.svg, errors: r.errors }; }
    else { var h = cd.renderHits(text, { classes: true, groups: g, DOMParser: DP, log: log, glyph: glyphs(job.src) }); out = { svg: h[0], hits: h[1] }; }
  } catch (e) { out = { error: String(e && e.message || e) }; }
  process.stdout.write(JSON.stringify(out) + '\n');
});
