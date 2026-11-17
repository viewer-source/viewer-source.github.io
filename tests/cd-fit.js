// cd_edit.place(..., { fit: true }), the right-click menu's Resize canvas on CellDesigner maps: for every CellDesigner map,
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
// free texts and a free line (no demo map has a layer): put into the first map, far right and below, and a second time with
// a node first moved past the top left (the editor's file then already shifted out of negative places, its GraphML not)
function layered(t) {
  return t.replace('<celldesigner:listOfLayers/>', '<celldesigner:listOfLayers>\n<celldesigner:layer id="1" name="L" locked="false" visible="true">\n' +
    '<celldesigner:listOfTexts>\n<celldesigner:layerSpeciesAlias x="0.0" y="0.0">\n<celldesigner:layerNotes>\nnote\n</celldesigner:layerNotes>\n' +
    '<celldesigner:bounds x="2000.0" y="1500.0" w="300.0" h="60.0"/>\n<celldesigner:paint color="ff000000"/>\n<celldesigner:font size="12"/>\n</celldesigner:layerSpeciesAlias>\n</celldesigner:listOfTexts>\n' +
    '<celldesigner:listOfFreeLines>\n<celldesigner:layerFreeLine isArrow="false" isDotted="false">\n<celldesigner:bounds sx="2400.0" sy="1700.0" ex="2600.0" ey="1900.0"/>\n' +
    '<celldesigner:line width="1.0" color="ff000000"/>\n</celldesigner:layerFreeLine>\n</celldesigner:listOfFreeLines>\n</celldesigner:layer>\n</celldesigner:listOfLayers>');
}
function layerNums(t) { var o = [], re = /<celldesigner:bounds ((?:s?[xy]|[se][xy]|[wh])="[^"]*"[^>]*)>/g, ly = /<celldesigner:listOfLayers>[\s\S]*?<\/celldesigner:listOfLayers>/.exec(t), m; while (ly && (m = re.exec(ly[0]))) { var v = {}; m[1].replace(/\b(\w+)="([^"]*)"/g, function (_, k, x) { v[k] = parseFloat(x); }); o.push(v); } return o; }
(function () {
  var f = files.filter(function (p) { return fs.readFileSync(p, 'utf8').indexOf('<celldesigner:listOfLayers/>') >= 0; })[0];
  if (!f) return;
  var name = path.relative(process.cwd(), f) + ' with free texts';
  try {
    var t = layered(fs.readFileSync(f, 'utf8')), g = ed.graphml(t, null, opt), r = ed.place(t, g, { DOMParser: DP, fit: true }), a = layerNums(t), b = layerNums(r[0]), d = new cdr.Drawing(r[0], opt);
    if (b.length !== 2 || b[0].x !== a[0].x + r[1][0] || b[0].y !== a[0].y + r[1][1] || b[1].sx !== a[1].sx + r[1][0] || b[1].ey !== a[1].ey + r[1][1]) throw new Error('free text or line not moved by the shift: ' + JSON.stringify([a, b, r[1]]));
    if (d.W !== Math.ceil(2600 + r[1][0] + 40) || d.H !== Math.ceil(1900 + r[1][1] + 40)) throw new Error('canvas not round the free line: ' + d.W + ' x ' + d.H);
    // a node moved past the top left, drawn (the file shifted), then fitted from the file and its own GraphML, as the editor does
    var id = /<node id="([^"|]+)"/.exec(g)[1], g2 = g.replace(new RegExp('(<node id="' + id + '">[\\s\\S]*?<y:Geometry )x="[^"]*" y="[^"]*"'), '$1x="-500" y="-300"');
    var now = ed.draw(t, g2, opt)[1], r2 = ed.place(now, ed.graphml(now, null, opt), { DOMParser: DP, fit: true }), c = layerNums(now), e = layerNums(r2[0]);
    var a0 = aliasBounds(t), bb = aliasBounds(r2[0]), still = Object.keys(a0).filter(function (k) { return k !== id; })[0];   // a node not moved: the free texts keep their place beside it
    if (Math.abs((e[0].x - bb[still].x) - (a[0].x - a0[still].x)) > 1e-3 || Math.abs((e[0].y - bb[still].y) - (a[0].y - a0[still].y)) > 1e-3 || Math.abs((e[1].sx - bb[still].x) - (a[1].sx - a0[still].x)) > 1e-3)
      throw new Error('after a move past the edge: the free texts moved apart from the map ' + JSON.stringify([a, e, r2[1]]));
    bb = aliasBounds(r2[0]), mx = Infinity, my = Infinity; Object.keys(bb).forEach(function (k) { mx = Math.min(mx, bb[k].x); my = Math.min(my, bb[k].y); });
    if (mx < 40 || mx > 56 || my < 40 || my > 56) throw new Error('after a move past the edge: top left at ' + mx + ', ' + my);
    ok++; files.push(name);
  } catch (e) { bad.push(name + ': ' + (e && e.message || e)); }
})();
console.log(ok + ' of ' + files.length + ' CellDesigner maps fitted');
bad.forEach(function (l) { console.log('  ' + l); });
process.exit(bad.length || !files.length ? 1 : 0);
