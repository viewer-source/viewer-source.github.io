// The build's renderers in JavaScript (the master for the viewer's own build and the
// editor): build.py starts this once and asks it, one line of JSON per map, for a drawing; it answers one line each.
//   {"kind":"yed","src":path,"sbgn":true}  -> {"svg":...,"errors":[...]}   (yrender.js, classes on; sbgn: a GraphML made from SBGN-ML)
//   {"kind":"cd","src":path}   -> {"svg":...,"hits":{...}}     (cdrender.js, classes on, with the click data)
//   either with "groups":true  -> {"svg":...}   the editor's drawing, each node and line in a group of its own (data-n,
//                                                data-e), read by the build for the lines a click lights; never published
//   anything that fails           -> {"error": message}
// Needs @xmldom/xmldom (npm install in the repository, or NODE_PATH).
var fs = require('fs'), path = require('path'), readline = require('readline');
var DP = require('@xmldom/xmldom').DOMParser;
var yr = require(path.join(__dirname, 'yrender', 'yrender.js')), cd = require(path.join(__dirname, 'converter', 'cdrender.js'));
var log = function (s) { process.stderr.write(s + '\n'); };
readline.createInterface({ input: process.stdin }).on('line', function (line) {
  var out;
  try {
    var job = JSON.parse(line), text = fs.readFileSync(job.src, 'utf8');
    if (job.groups) out = { svg: job.kind === 'yed' ? yr.render(text, { groups: true, sbgn: !!job.sbgn, DOMParser: DP }).svg : cd.render(text, { groups: true, DOMParser: DP, log: log }) };
    else if (job.kind === 'yed') { var r = yr.render(text, { classes: true, sbgn: !!job.sbgn, DOMParser: DP }); out = { svg: r.svg, errors: r.errors }; }
    else { var h = cd.renderHits(text, { classes: true, DOMParser: DP, log: log }); out = { svg: h[0], hits: h[1] }; }
  } catch (e) { out = { error: String(e && e.message || e) }; }
  process.stdout.write(JSON.stringify(out) + '\n');
});
