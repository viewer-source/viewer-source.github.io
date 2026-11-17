// Ports on a grid (editor/src/core.js, portStep and gridSpot), the geometry alone: the functions are taken from core.js
// as they stand and run on a simple molecule (circle r 20) and a protein (80 by 40, corner radius 5, quadratic corners
// as drawn), with a few other shapes (an octagon complex, an ellipse wider than high, a plain rectangle, an inset
// protein). Checks the arrow keys inside, on the outline, across it, at a run's end, and a drag's snapping.
//   node tests/port-grid.js
var fs = require('fs'), path = require('path');
var src = fs.readFileSync(path.join(__dirname, '../editor/src/core.js'), 'utf8');
function fn(name) {   // a function's text from core.js, by brace matching
  var i = src.indexOf('function ' + name + '('), j = src.indexOf('{', i), d = 0, k = j;
  if (i < 0) throw new Error(name + ' not found');
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
var V = { z: 1 }, PG = 5, shapes = {};
function rim(n) { var s = shapes[n]; return flatten(outlineD(s.sh, -s.w / 2, -s.h / 2, s.w, s.h)); }
eval(['rr', 'poly', 'outlineD', 'flatten', 'keyAx', 'gridNext', 'dec2', 'onRim', 'inRim', 'along', 'portStep', 'gridSpot'].map(fn).join('\n'));
shapes.sm = { sh: { kind: 'SimpleChemical', props: {} }, w: 40, h: 40 };
shapes.pr = { sh: { kind: 'Macromolecule', props: { radius: '5' } }, w: 80, h: 40 };
var bad = 0, R = [1, 0], L = [-1, 0], U = [0, -1], D = [0, 1];
function run(n, o, keys, g) { var out = []; keys.forEach(function (d) { var t = portStep(n, o, d, g || PG); out.push(t ? t.join(',') : 'stop'); if (t) o = t; }); return out.join(' '); }
function ok(what, got, want) { var y = got === want; if (!y) bad++; console.log((y ? 'ok    ' : 'WRONG ') + what + (y ? '' : '\n        got  ' + got + '\n        want ' + want)); }
ok('circle, top, Right x4', run('sm', [0, -20], [R, R, R, R]), '5,-19.36 10,-17.32 14.14,-14.14 stop');
ok('circle, 45 degrees, Down x3', run('sm', [14.14, -14.14], [D, D, D]), '17.32,-10 19.36,-5 20,0');
ok('circle, top, Up (outward)', run('sm', [0, -20], [U]), 'stop');
ok('circle, top, Down (inward)', run('sm', [0, -20], [D, D]), '0,-15 0,-10');
ok('circle, 45 degrees, Right (outward)', run('sm', [14.14, -14.14], [R]), 'stop');
ok('circle, 45 degrees, Left back along the top', run('sm', [14.14, -14.14], [L]), '10,-17.32');
ok('circle, centre, Right x5 (stops on the outline)', run('sm', [0, 0], [R, R, R, R, R]), '5,0 10,0 15,0 20,0 stop');
ok('circle, inside (5,15), Down (meets the outline)', run('sm', [5, 15], [D]), '5,19.36');
ok('protein, top, Right x8 then the corner', run('pr', [0, -20], [R, R, R, R, R, R, R, R, R]), '5,-20 10,-20 15,-20 20,-20 25,-20 30,-20 35,-20 38.75,-18.75 stop');
ok('protein, corner, Down x2 onto the side', run('pr', [38.75, -18.75], [D, D, D]), '40,-15 40,-10 40,-5');
ok('protein, right side to the bottom corner', run('pr', [40, 10], [D, D, D]), '40,15 38.75,18.75 stop');
ok('protein, top, Shift: 1 px', run('pr', [0, -20], [R, R], 1), '1,-20 2,-20');
ok('protein, centre, Up x5', run('pr', [0, 0], [U, U, U, U, U]), '0,-5 0,-10 0,-15 0,-20 stop');
ok('protein 83 by 43: the side reached', (shapes.p2 = { sh: shapes.pr.sh, w: 83, h: 43 }, run('p2', [35, 0], [R, R])), '40,0 41.5,0');
ok('protein 83 by 43: inward from the top', run('p2', [0, -21.5], [D]), '0,-20');
ok('drag: inside onto the grid', gridSpot('pr', [12, 6], false).join(','), '10,5');
ok('drag: near the top onto the outline, x on the grid', gridSpot('pr', [12, -18.5], false).join(','), '10,-20');
ok('drag: outside onto the outline', gridSpot('pr', [21, -30], false).join(','), '20,-20');
ok('drag: circle outside, at 30 degrees', gridSpot('sm', [27, -15], false).join(','), '17.32,-10');
ok('drag: free (Alt) inside', gridSpot('pr', [12.3, 6.7], true).join(','), '12.3,6.7');
ok('drag zoomed in near a curve: the nearest grid point inside', (V.z = 4, gridSpot('sm', [13, 13], false).join(',')), '10,15'); V.z = 1;
shapes.ins = { sh: { kind: 'Macromolecule', props: { radius: '5', inset: '0.125' } }, w: 80, h: 40 };
ok('outside the shape (inset protein): onto the outline first', run('ins', [0, -20], [D, D]), '0,-15 0,-10');
shapes.el = { sh: { kind: 'ellipse', props: {} }, w: 80, h: 40 };
ok('ellipse 80 by 40, top, Right to its 45 degree point', run('el', [0, -20], [R, R, R, R, R, R, R, R, R]).split(' ').slice(-2).join(' '), '35.78,-8.94 stop');
ok('ellipse 80 by 40, from its 45 degree point down the side', run('el', [35.78, -8.94], [D, D]), '38.73,-5 40,0');
shapes.rc = { sh: { kind: 'rectangle', props: {} }, w: 60, h: 30 };
ok('rectangle 60 by 30, top to the corner, then down', run('rc', [20, -15], [R, R, R, D]), '25,-15 30,-15 stop 30,-10');
shapes.cx = { sh: { kind: 'Complex', props: {} }, w: 100, h: 60 };
ok('complex octagon, side to its corner, Down stops there', run('cx', [50, 10], [D, D]), '50,15 stop');
ok('complex octagon, from the corner Left along the chamfer (an x run)', run('cx', [50, 15], [L, L]), '45,20 40,25');
ok('no offsets (NaN) never throws', String(gridSpot('pr', [0, 0], false)), '0,0');
console.log(bad ? bad + ' wrong' : 'all ok');
process.exit(bad ? 1 : 0);
