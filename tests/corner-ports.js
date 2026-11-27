// A line's end at a port off the rounded outline but inside the node's box (yrender cornerEnd, corner_end in rules.md):
// on Aspirin (SBGN-ML, read into GraphML by the converter's copy as the build does), COX-1's catalysis to its process
// given the port 40, -16.72 (the box's right side, in its top right rounded corner) starts on the outline, on the
// line's own way (no bend added); the port 40, 16.72 at the lower corner, which lies inside the multimer's back copy,
// starts where it did; a port outside the box (50, -16.72) is drawn as given (a hand-made gap). Node only, no browser.
//   node tests/corner-ports.js --data=<clone of the data repository>
var fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), yr = require(path.join(here, 'renderers/yrender/yrender.js')), DP = require('@xmldom/xmldom').DOMParser;
var dataArg = process.argv.slice(2).filter(function (a) { return /^--data=/.test(a); })[0];
if (!dataArg) { console.log('give --data=<clone of the data repository>'); process.exit(2); }
var data = dataArg.slice(7);
var file = path.join(data, 'maps/sbgn-ml/aspirin-sbgn.sbgn');
var py = ['import sys, io, contextlib', 'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']',
  'from mapconv import sbgnml, graphml, report',
  'with report.collect(), contextlib.redirect_stdout(io.StringIO()): g = graphml.write(sbgnml.read(sys.argv[1]))', 'sys.stdout.write(g)'].join('\n');
var G = cp.execFileSync('python3', ['-c', py, file]).toString();
var bad = 0, n = 0;
function ok(what, cond, more) { n++; if (!cond) bad++; console.log((cond ? 'ok    ' : 'WRONG ') + what + (cond || !more ? '' : ': ' + more)); }
function withPort(sx, sy) {   // COX-1's catalysis e17 with its source port at sx, sy
  var i = G.indexOf('<edge id="e17"'), j = G.indexOf('</edge>', i);
  return G.slice(0, i) + G.slice(i, j).replace(/sx="[^"]*" sy="[^"]*"/, 'sx="' + sx + '" sy="' + sy + '"') + G.slice(j);
}
function line(sx, sy) {   // the drawn line of e17 (editor's groups: the arc's own g), as its points
  var svg = yr.render(withPort(sx, sy), { DOMParser: DP, classes: true, groups: true }).svg;
  var g = /<g[^>]*data-e="e17"[^>]*>([\s\S]*?)<\/g>/.exec(svg), d = /<path d="(M[^"]*)" fill="none"/.exec(g[1])[1];
  return d.match(/-?[\d.]+/g).map(Number).reduce(function (a, v, k) { if (k % 2) a[a.length - 1].push(v); else a.push([v]); return a; }, []);
}
var X = 216.01141624965982, Y = 129.77150537634418, W = 80, H = 40, R = 10, cx = X + W / 2, cy = Y + H / 2;
function onRounded(p) {   // within 0.6 of COX-1's front outline (its radius 10, yEd's quadratic corners)
  var best = Infinity, x1 = X + W, y0 = Y;
  for (var t = 0; t <= 1.0001; t += 0.002) {   // the top right corner: from (x1 - R, y0) by control (x1, y0) to (x1, y0 + R)
    var qx = (1 - t) * (1 - t) * (x1 - R) + 2 * (1 - t) * t * x1 + t * t * x1, qy = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * y0 + t * t * (y0 + R);
    best = Math.min(best, Math.hypot(qx - p[0], qy - p[1]));
  }
  return best < 0.6;
}
function collinear(a, b, c) { return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / Math.hypot(c[0] - a[0], c[1] - a[1]) < 0.05; }
var port = [cx + 40, cy - 16.72], L = line(40, -16.72), s = L[0];
ok('a corner port in the box starts on the rounded outline', onRounded(s), JSON.stringify(s));
ok('it moved inward from the port, not past the box', s[0] < port[0] && s[0] > X + W - R && s[1] > Y - 0.01, JSON.stringify(s));
ok('the line keeps its way (the start on the line from the port to the next point)', collinear(s, port, L[1]), JSON.stringify(L));
var low = line(40, 16.72);
ok('a corner port inside the multimer\'s back copy is reached as before (on the back copy)', Math.abs(low[0][0] - (X + W)) < 1e-6 || low[0][0] > X + W, JSON.stringify(low[0]));
var out = line(50, -16.72);
ok('a port outside the box is drawn as given (a hand-made gap)', Math.abs(out[0][0] - (cx + 50)) < 1e-3 && Math.abs(out[0][1] - (cy - 16.72)) < 1e-3, JSON.stringify(out[0]));
console.log(n - bad + ' of ' + n + ' ok');
process.exit(bad ? 1 : 0);
