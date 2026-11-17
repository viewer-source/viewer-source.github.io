// cd_edit.place(..., { fit: true }), the right-click menu's Fit canvas on CellDesigner maps: for every CellDesigner map,
// the canvas fitted round what is drawn (its top left MARGIN to MARGIN + 16 from the corner, MARGIN to spare past its right
// and bottom), everything moved by the same whole grid blocks, the reactions' own (relative) bend points untouched, the
// file read again by cdrender, and a second fit changing nothing.
//   node tests/cd-fit.js [CellDesigner files or folders ...]   (default: maps/)
var fs = require('fs'), path = require('path');
var here = path.join(__dirname, '..'), DP = require('@xmldom/xmldom').DOMParser;
global.DOMParser = DP;
var ed = require(path.join(here, 'renderers/converter/cd_edit.js')), cdr = require(path.join(here, 'renderers/converter/cdrender.js')), opt = { DOMParser: DP };
var files = [];
(process.argv.length > 2 ? process.argv.slice(2) : [path.join(here, 'maps')]).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.xml$/.test(p)) { var t = fs.readFileSync(p, 'utf8').slice(0, 3000); if (/<sbml[\s>]/.test(t) && t.indexOf('celldesigner') >= 0) files.push(p); }
});
function aliasBounds(t) {   // every alias's bounds, by id
  var o = {}, re = /<celldesigner:(?:species|complexSpecies|compartment)Alias [^>]*\bid="([^"]*)"[\s\S]*?<celldesigner:bounds ([^>]*)>/g, m;
  while ((m = re.exec(t))) { var v = {}; m[2].replace(/\b([xywh])="([^"]*)"/g, function (_, k, x) { v[k] = parseFloat(x); }); o[m[1]] = v; }
  return o;
}
function editPoints(t) { var o = [], re = /<reaction [^>]*\bid="([^"]*)"[\s\S]*?<celldesigner:editPoints>([^<]*)</g, m; while ((m = re.exec(t))) o.push(m[1] + ':' + m[2]); return o.join('|'); }
var ok = 0, bad = [];
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8'), name = path.relative(process.cwd(), f);
  try {
    var g = ed.graphml(t, null, opt), r = ed.place(t, g, { DOMParser: DP, fit: true }), t2 = r[0], sh = r[1];
    var a = aliasBounds(t), b = aliasBounds(t2), d = new cdr.Drawing(t2, opt);
    Object.keys(a).forEach(function (id) {
      if (!b[id]) throw new Error(id + ' lost');
      if (Math.abs(b[id].x - a[id].x - sh[0]) > 1e-3 || Math.abs(b[id].y - a[id].y - sh[1]) > 1e-3 || b[id].w !== a[id].w || b[id].h !== a[id].h) throw new Error(id + ' not moved by the shift');
    });
    if (sh[0] % 16 || sh[1] % 16) throw new Error('shift not whole blocks: ' + sh);
    if (editPoints(t) !== editPoints(t2)) throw new Error('a reaction\'s own bend points changed');
    var mx = Infinity, my = Infinity, Mx = -Infinity, My = -Infinity;
    Object.keys(b).forEach(function (id) { var q = b[id]; mx = Math.min(mx, q.x); my = Math.min(my, q.y); Mx = Math.max(Mx, q.x + q.w); My = Math.max(My, q.y + q.h); });
    if (mx > 56 || my > 56) throw new Error('top left still far: ' + mx + ', ' + my);
    if (d.W < Mx + 40 || d.H < My + 40) throw new Error('canvas too small: ' + d.W + ' x ' + d.H + ' for ' + Mx + ', ' + My);
    var g2 = ed.graphml(t2, null, opt), r2 = ed.place(t2, g2, { DOMParser: DP, fit: true });
    if (r2[0] !== t2) throw new Error('a second fit changed the file');
    ok++;
  } catch (e) { bad.push(name + ': ' + (e && e.message || e)); }
});
console.log(ok + ' of ' + files.length + ' CellDesigner maps fitted');
bad.forEach(function (l) { console.log('  ' + l); });
process.exit(bad.length || !files.length ? 1 : 0);
