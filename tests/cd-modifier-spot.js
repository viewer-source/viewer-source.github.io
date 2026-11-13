// A modifier's end moved round its process glyph (user, 2026-11-13: CellDesigner has six places there, the corners and
// the middles of the two sides off the main line; no centre, nothing on the line): the first three modifiers at a glyph
// of each demo CellDesigner map (each draw writes the whole file) set to each of the six places as the editor offers them
// (turned with the main line, read from the GraphML), written back by cd_edit: the file's targetLineIndex names that
// place, the GraphML made again from the file has the end there, and the modifier's anchor points stay where they were.
//   node tests/cd-modifier-spot.js [CellDesigner files or folders ...]   (default: maps/)
var fs = require('fs'), path = require('path');
var here = path.join(__dirname, '..'), DP = require('@xmldom/xmldom').DOMParser;
global.DOMParser = DP;
var ed = require(path.join(here, 'renderers/converter/cd_edit.js')), opt = { DOMParser: DP };
var Y = 'http://www.yworks.com/xml/graphml', G = 'http://graphml.graphdrawing.org/xmlns';
var SPOTS = { 2: [0, -1], 3: [0, 1], 4: [-1, -1], 5: [1, -1], 6: [-1, 1], 7: [1, 1] };
var files = [];
(process.argv.length > 2 ? process.argv.slice(2) : [path.join(here, 'maps')]).forEach(function walk(p) {
  var st = fs.statSync(p);
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules|extra)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.xml$/.test(p) && /<celldesigner:/.test(fs.readFileSync(p, 'utf8').slice(0, 4000))) files.push(p);
});
function read(g) {
  var r = new DP().parseFromString(g, 'application/xml'), box = {}, edges = {};
  Array.from(r.getElementsByTagNameNS(G, 'node')).forEach(function (n) {
    var geo = n.getElementsByTagNameNS(Y, 'Geometry')[0];
    box[n.getAttribute('id')] = ['x', 'y', 'width', 'height'].map(function (k) { return +geo.getAttribute(k); });
  });
  Array.from(r.getElementsByTagNameNS(G, 'edge')).forEach(function (e) {
    var pa = e.getElementsByTagNameNS(Y, 'Path')[0];
    edges[e.getAttribute('id')] = { s: e.getAttribute('source'), t: e.getAttribute('target'), path: pa,
      at: function (k) { return +(pa.getAttribute(k) || 0); },
      pts: Array.from(e.getElementsByTagNameNS(Y, 'Point')).map(function (q) { return [+q.getAttribute('x'), +q.getAttribute('y')]; }) };
  });
  return { doc: r, box: box, edges: edges };
}
var cen = function (b) { return [b[0] + b[2] / 2, b[1] + b[3] / 2]; };
function spots(m, rid) {   // the six places round the glyph as the editor offers them (core.js procSpots)
  var a = m.edges[rid + '|a'], A = a.pts.length ? a.pts[a.pts.length - 1] : cen(m.box[a.s]).map(function (v, i) { return v + a.at(i ? 'sy' : 'sx'); });
  var C = cen(m.box[rid + '|proc']), L = Math.hypot(C[0] - A[0], C[1] - A[1]), f = [(C[0] - A[0]) / L, (C[1] - A[1]) / L], h = m.box[rid + '|proc'][2] / 2;
  var out = {};
  Object.keys(SPOTS).forEach(function (k) { var s = SPOTS[k]; out[k] = [h * (s[0] * f[0] - s[1] * f[1]), h * (s[0] * f[1] + s[1] * f[0])]; });
  return out;
}
var n = 0, bad = 0;
function fail(msg) { bad++; if (bad <= 10) console.log(msg); }
files.forEach(function (f) {
  var base = fs.readFileSync(f, 'utf8'), g = ed.graphml(base, [0, 0], opt), m = read(g), rel = path.relative(here, f);
  Object.keys(m.edges).filter(function (id) { return /\|m\d+$/.test(id) && /\|proc$/.test(m.edges[id].t); }).slice(0, 3).forEach(function (id) {
    var rid = id.replace(/\|m\d+$/, ''), sp = spots(m, rid), n0 = /\|m(\d+)$/.exec(id)[1];
    Object.keys(sp).forEach(function (k) {
      n++;
      var e = m.edges[id];
      e.path.setAttribute('tx', String(sp[k][0])); e.path.setAttribute('ty', String(sp[k][1])); e.path.setAttribute('spot', k);   // as the editor's setPort
      var g2 = m.doc.toString(), q = ed.draw(base, g2, opt), t = q[1], m2 = read(q[2]);
      var rx = new RegExp('<reaction [^>]*\\bid="' + rid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[\\s\\S]*?</reaction>').exec(t)[0];
      var mods = rx.match(/<celldesigner:modification [^>]*>/g), tag = mods[+n0], tli = /targetLineIndex="([^"]*)"/.exec(tag);
      var want = k === '2' ? (tli === null || tli[1].split(',')[1] === '2') : tli && tli[1].split(',')[1] === k;
      if (!want) return fail(rel + ' ' + id + ' place ' + k + ': targetLineIndex ' + (tli ? tli[1] : 'none'));
      var e2 = m2.edges[id];
      if (Math.hypot(e2.at('tx') - sp[k][0], e2.at('ty') - sp[k][1]) > 0.01) return fail(rel + ' ' + id + ' place ' + k + ': the end not there after writing');
      if (e2.pts.length !== e.pts.length || e2.pts.some(function (p, i) { return Math.hypot(p[0] - e.pts[i][0], p[1] - e.pts[i][1]) > 0.01; }))
        return fail(rel + ' ' + id + ' place ' + k + ': anchor points moved');
    });
    m = read(g);   // the next modifier from the file as it was
  });
});
// a main line turned (its product moved across it), drawn, then drawn again from the GraphML made of that file, as the
// next move does (the review, 2026-11-13: a place worked out from geometry was read in the wrong frame and every modifier
// jumped): the places stay; then each modifier set to a place in the turned frame stays there over a second drawing too
var tli = function (t, rid) {
  var rx = new RegExp('<reaction [^>]*\\bid="' + rid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[\\s\\S]*?</reaction>').exec(t)[0];
  return (rx.match(/<celldesigner:modification [^>]*>/g) || []).map(function (x) { var q = /targetLineIndex="([^"]*)"/.exec(x); return q ? q[1] : '-1,2'; }).join(' ');
};
var turned = 0;
files.forEach(function (f) {
  var base = fs.readFileSync(f, 'utf8'), m = read(ed.graphml(base, [0, 0], opt)), rel = path.relative(here, f), c = 0;
  Object.keys(m.edges).filter(function (id) { return /\|b$/.test(id) && !m.edges[id].pts.length && !m.edges[id.replace(/b$/, 'a')].pts.length; }).forEach(function (bid) {
    var rid = bid.slice(0, -2);
    if (c >= 2 || !m.edges[rid + '|m0'] || /\|proc$/.test(m.edges[bid].t)) return;
    c++; turned++;
    var mm = read(ed.graphml(base, [0, 0], opt)), a = mm.edges[rid + '|a'], b = mm.edges[bid], C = cen(mm.box[rid + '|proc']), A = cen(mm.box[a.s]);
    var L = Math.hypot(C[0] - A[0], C[1] - A[1]), u = [(C[0] - A[0]) / L, (C[1] - A[1]) / L];
    var geo = Array.from(mm.doc.getElementsByTagNameNS(G, 'node')).filter(function (x) { return x.getAttribute('id') === b.t; })[0].getElementsByTagNameNS(Y, 'Geometry')[0];
    var bx = mm.box[b.t], P = [C[0] - u[1] * 200, C[1] + u[0] * 200];   // the product put across the line, 200 away
    geo.setAttribute('x', String(P[0] - bx[2] / 2)); geo.setAttribute('y', String(P[1] - bx[3] / 2));
    var q1 = ed.draw(base, mm.doc.toString(), opt), q2 = ed.draw(base, q1[2], opt);
    if (tli(q1[1], rid) !== tli(base, rid) || tli(q2[1], rid) !== tli(base, rid)) return fail(rel + ' ' + rid + ' turned: ' + tli(base, rid) + ' became ' + tli(q1[1], rid) + ' then ' + tli(q2[1], rid));
    var m2 = read(q1[2]), sp = spots(m2, rid), e = m2.edges[rid + '|m0'], k = Object.keys(sp).filter(function (k2) { return +k2 !== +e.path.getAttribute('spot'); })[0];
    e.path.setAttribute('tx', String(sp[k][0])); e.path.setAttribute('ty', String(sp[k][1])); e.path.setAttribute('spot', k);
    var q3 = ed.draw(base, m2.doc.toString(), opt), q4 = ed.draw(base, q3[2], opt), want = tli(q3[1], rid).split(' ')[0];
    if (want.split(',')[1] !== k || tli(q4[1], rid) !== tli(q3[1], rid)) return fail(rel + ' ' + rid + ' turned, set to ' + k + ': ' + tli(q3[1], rid) + ' then ' + tli(q4[1], rid));
    var e4 = read(q3[2]).edges[rid + '|m0'], s4 = spots(read(q3[2]), rid)[k];
    if (Math.hypot(e4.at('tx') - s4[0], e4.at('ty') - s4[1]) > 0.01) fail(rel + ' ' + rid + ' turned, set to ' + k + ': not drawn there');
  });
});
console.log(turned + ' reactions with a turned main line: places kept over two drawings, a place set in the turned frame kept');
console.log(n + ' modifier ends set round their glyph: ' + (n - bad) + ' written to the place, ' + bad + ' not');
process.exit(bad ? 1 : 0);
