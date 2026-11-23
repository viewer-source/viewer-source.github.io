// cd_edit.live() against cd_edit.draw(): the editor's live drawing of a move (each reaction the move touches, drawn by the
// drop's own code) must be the same text as the drawing made after the drop, reaction by reaction. For every CellDesigner
// map: three made-up moves of nodes, bend points and line ends (as tests/cd-compare.js makes them), every reaction drawn
// live, its halo and lines found as they are in draw()'s picture; and line ends moved to another species (as
// tests/cd-reconnect.js picks them), drawn live with the new end as the drop draws them.
// Each map is parsed once and that document handed to graphml() and to every live() of it, as the editor does (one
// document per text, read only): a reader writing into it would change the later moves' drawings. Checked too: graphml()
// gives the same text from the shared document as from the text, and draw()'s opt.parsed is given its new text's document.
//   node tests/cd-live.js [CellDesigner files or folders ...]   (default: maps/)
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
var YNS = 'http://www.yworks.com/xml/graphml', GNS = 'http://graphml.graphdrawing.org/xmlns';
function rnd(seed) { var s = seed * 2654435761 % 4294967296; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
function all(el, ns, name) { return Array.prototype.slice.call(el.getElementsByTagNameNS(ns, name)); }
function read(g) {   // node boxes, edge bend points and line ends, by id
  var r = new DP().parseFromString(g, 'application/xml').documentElement, b = new Map(), p = new Map(), q = new Map();
  all(r, GNS, 'node').forEach(function (n) { var x = all(n, YNS, 'Geometry')[0]; b.set(n.getAttribute('id'), ['x', 'y', 'width', 'height'].map(function (k) { return parseFloat(x.getAttribute(k)); })); });
  all(r, GNS, 'edge').forEach(function (e) {
    p.set(e.getAttribute('id'), all(e, YNS, 'Point').map(function (pt) { return [parseFloat(pt.getAttribute('x')), parseFloat(pt.getAttribute('y'))]; }));
    var pa = all(e, YNS, 'Path')[0]; if (pa) q.set(e.getAttribute('id'), ['sx', 'sy', 'tx', 'ty'].map(function (k) { return parseFloat(pa.getAttribute(k) || 0); }));
  });
  return [b, p, q];
}
function moved(g, seed) {   // the GraphML as the editor leaves it after some moves (no place past the left or top edge)
  var R = rnd(seed), pick = function (a, n) { a = a.slice(); var o = []; while (a.length && o.length < n) o.push(a.splice(Math.floor(R() * a.length), 1)[0]); return o; };
  var doc = new DP().parseFromString(g, 'application/xml'), r = doc.documentElement;
  var nodes = all(r, GNS, 'node').filter(function (n) { return !/\|proc$/.test(n.getAttribute('id')) && !all(n, GNS, 'graph').length; });
  pick(nodes, 3).forEach(function (n) { all(n, YNS, 'Geometry').forEach(function (x) {
    x.setAttribute('x', String(parseFloat(x.getAttribute('x')) + [12.0, 60.25, 33.5][Math.floor(R() * 3)]));
    x.setAttribute('y', String(parseFloat(x.getAttribute('y')) + [8.5, 33.0, 20.0][Math.floor(R() * 3)])); }); });
  pick(all(r, YNS, 'Point'), 3).forEach(function (p) { p.setAttribute('x', String(parseFloat(p.getAttribute('x')) + 7.0)); p.setAttribute('y', String(parseFloat(p.getAttribute('y')) + 11.5)); });
  pick(all(r, YNS, 'Path'), 2).forEach(function (p) { p.setAttribute('sx', '0.0'); p.setAttribute('sy', '-20.0'); });
  return new (require('@xmldom/xmldom').XMLSerializer)().serializeToString(doc);
}
function kinds(g) {   // the species a line's end may move to (no glyph, gate, compartment or complex member), the edges by id
  var d = new DP().parseFromString(g, 'application/xml'), N = {}, E = {};
  all(d, GNS, 'node').forEach(function (n) {
    var up = n.parentNode && n.parentNode.parentNode, grp = n.getAttribute('yfiles.foldertype') === 'group';
    var rs = grp && all(n, YNS, 'Realizers')[0], r0 = rs && Array.prototype.filter.call(rs.childNodes, function (c) { return c.nodeType === 1; })[0];
    N[n.getAttribute('id')] = { complex: !!(r0 && r0.localName === 'GenericGroupNode'), comp: grp && !(r0 && r0.localName === 'GenericGroupNode'), up: up && up.localName === 'node' ? up.getAttribute('id') : null };
  });
  all(d, GNS, 'edge').forEach(function (e) { E[e.getAttribute('id')] = [e.getAttribute('source'), e.getAttribute('target')]; });
  var ok = function (id) { var n = N[id]; return n && !/\|(proc|g\d*)$/.test(id) && !n.comp && !(n.up && N[n.up] && N[n.up].complex); };
  return { ok: ok, N: N, E: E };
}
function setEnd(g, eid, j, to, port) {   // edge eid's end j (0 source, 1 target) on node to at offset port, as the editor's reconnect
  var doc = new DP().parseFromString(g, 'application/xml'), e = all(doc.documentElement, GNS, 'edge').filter(function (x) { return x.getAttribute('id') === eid; })[0];
  e.setAttribute(j ? 'target' : 'source', to);
  var pa = all(e, YNS, 'Path')[0]; pa.setAttribute(j ? 'tx' : 'sx', port[0]); pa.setAttribute(j ? 'ty' : 'sy', port[1]);
  return new (require('@xmldom/xmldom').XMLSerializer)().serializeToString(doc);
}
var same = 0, diff = 0, skipped = 0, bad = [], recon = 0;
var docs = {}, shared = function (f, t) { return docs[f] || (docs[f] = { DOMParser: DP, doc: new DP().parseFromString(t, 'application/xml') }); };
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8'), g;
  try { g = ed.graphml(t, null, shared(f, t)); } catch (e) { return; }
  if (g !== ed.graphml(t, null, opt)) { diff++; bad.push(path.basename(f) + ': graphml() from the shared document differs from the text\'s'); }
  var base = read(g), rids = [];
  base[1].forEach(function (v, k) { var m = /^(.*)\|(a|b|[rpmi]\d+)$/.exec(k); if (m && rids.indexOf(m[1]) < 0) rids.push(m[1]); });
  [1, 2, 3].forEach(function (seed) {
    var mg = moved(g, seed), q;
    var given = null;
    try { q = ed.draw(t, mg, { DOMParser: DP, parsed: function (c, d) { given = [c, d]; } }); } catch (e) { return; }
    if (!given || given[0] !== q[1] || !given[1].documentElement) { diff++; bad.push(path.basename(f) + ' seed ' + seed + ': draw() did not give its new text\'s document'); }
    if (/<g transform="translate\(0,0\)"><g transform/.test(q[0])) { skipped++; return; }   // shifted after the drop: not live
    // the drawing after the drop, its halos and its lines apart (draw() is place() then this drawing)
    var D = new cdr.Drawing(q[1], { classes: true, groups: true, DOMParser: DP }), svg = D.svg();
    if (svg !== q[0]) { diff++; bad.push(path.basename(f) + ' seed ' + seed + ': draw() differs from place() and its drawing'); return; }
    var halo = D.halo.join('\n'), lines = D.lines.join('\n');
    var now = read(mg), boxes = new Map();
    now[0].forEach(function (b, k) { var o = base[0].get(k); if (!o || b.some(function (v, j) { return v !== o[j]; })) boxes.set(k, b); });
    var S = ed.live(t, g, shared(f, t)), out = S.frame(boxes, now[1], now[2], rids);
    S.errors.forEach(function (e) { diff++; if (bad.length < 10) bad.push(path.basename(f) + ' seed ' + seed + ' failed: ' + e); });
    rids.forEach(function (rid) {
      var o = out[rid];
      if (!o) { skipped++; return; }
      if (halo.indexOf(o.halo) >= 0 && lines.indexOf(o.lines) >= 0) same++;
      else { diff++; if (bad.length < 10) bad.push(path.basename(f) + ' seed ' + seed + ' ' + rid); }
    });
  });
});
// line ends moved to another species: the reaction drawn live with the new end, against the drop's drawing
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8'), g;
  try { g = ed.graphml(t, null, shared(f, t)); } catch (e) { return; }
  var K = kinds(g), targets = Object.keys(K.N).filter(K.ok), base = read(g);
  [[/\|a$/, 0], [/\|b$/, 1], [/\|m\d+$/, 0], [/\|r\d+$/, 0], [/\|p\d+$/, 1]].forEach(function (k, ki) {
    var eid = Object.keys(K.E).filter(function (e) { return k[0].test(e) && K.ok(K.E[e][k[1]]) && !/\|g\d*$/.test(K.E[e][1 - k[1]]); })[0];
    if (!eid) return;
    var rid = eid.slice(0, eid.lastIndexOf('|')), inRx = [];
    Object.keys(K.E).forEach(function (e) { if (e.indexOf(rid + '|') === 0) inRx = inRx.concat(K.E[e]); });
    var free = targets.filter(function (x) { return inRx.indexOf(x) < 0; }), to = free[ki * 3 % Math.max(1, free.length)];
    if (!to) return;
    var mg = setEnd(g, eid, k[1], to, ki % 2 ? ['0.0', '0.0'] : ['0.0', '-10.0']), q;
    try { q = ed.draw(t, mg, opt); } catch (e) { return; }
    if (/<g transform="translate\(0,0\)"><g transform/.test(q[0])) { skipped++; return; }
    var D = new cdr.Drawing(q[1], { classes: true, groups: true, DOMParser: DP }); D.svg();
    var now = read(mg), ends = new Map([[eid, K.E[eid].map(function (x, j) { return j === k[1] ? to : x; })]]);
    var S = ed.live(t, g, shared(f, t)), out = S.frame(new Map(), now[1], now[2], [rid], ends);
    S.errors.forEach(function (e) { diff++; if (bad.length < 10) bad.push(path.basename(f) + ' end of ' + eid + ' failed: ' + e); });
    var o = out[rid];
    if (!o) { skipped++; return; }
    recon++;
    if (D.halo.join('\n').indexOf(o.halo) >= 0 && D.lines.join('\n').indexOf(o.lines) >= 0) same++;
    else { diff++; if (bad.length < 10) bad.push(path.basename(f) + ' end of ' + eid + ' to ' + to); }
  });
});
console.log(files.length + ' maps: ' + same + ' reactions drawn live the same as after the drop (' + recon + ' with an end moved to another species), ' + diff + ' different, ' + skipped + ' not drawn live (or the map shifted)');
if (bad.length) console.log('different: ' + bad.join(', '));
process.exit(diff ? 1 : 0);
