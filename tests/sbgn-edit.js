// sbgn_edit.js against the converter (renderers/converter/mapconv, Python) on the demo's SBGN-ML maps:
//   1. graphml(s, conv(s)) is conv(s) byte for byte, and write(s, conv(s)) is s (nothing moved, nothing changed);
//   2. after moves as the editor makes them (nodes, a group with what it holds, bend points shifted, added and taken
//      out, an end set on a side, a process turned), conv(write(s, g)) has g's places (boxes and bends exactly, each
//      arc end the same or drawn the same: an end on the line toward its next point read as the centre), and
//      graphml(write(s, g), conv(s)) is conv(write(s, g)) byte for byte (the editor reopens a draft as the build will
//      draw it).
//   node tests/sbgn-edit.js [python] [SBGN-ML files or folders ...]   (default: python3; test-maps/sbgn-ml/pd, maps/,
//   downloads/*-sbgn.sbgn)
var fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
var here = path.join(__dirname, '..'), se = require(path.join(here, 'renderers/converter/sbgn_edit.js'));
var X = require('@xmldom/xmldom'), DP = X.DOMParser, opt = { DOMParser: DP };
var args = process.argv.slice(2), py = args[0] && !/\.(sbgn|nwt)$|\//.test(args[0]) && !fs.existsSync(args[0]) ? args.shift() : 'python3';
var files = [];
(args.length ? args : ['test-maps/sbgn-ml/pd', 'maps', 'downloads'].map(function (p) { return path.join(here, p); })).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules|validation)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.(sbgn|nwt)$/.test(p)) files.push(p);
});
var DRIVER = [
  'import sys, json, contextlib, io',
  'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']',
  'from mapconv import sbgnml, graphml, report',
  'out = []',
  'for f in json.load(sys.stdin):',
  '    try:',
  '        with report.collect(), contextlib.redirect_stdout(io.StringIO()): out.append(graphml.write(sbgnml.read(f)))',
  '    except Exception as e: out.append(None)',
  'json.dump(out, sys.stdout)'].join('\n');
function conv(paths) { return JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(paths), maxBuffer: 1 << 30 }).toString()); }

var Y = 'http://www.yworks.com/xml/graphml', G = 'http://graphml.graphdrawing.org/xmlns';
function rnd(seed) { return function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; }
function pick(r, a, n) { a = a.slice(); var out = []; while (a.length && out.length < n) out.push(a.splice(Math.floor(r() * a.length), 1)[0]); return out; }
function F(v) { return parseFloat(v); }
function geoOf(n) {
  var dd = Array.prototype.filter.call(n.childNodes, function (c) { return c.localName === 'data'; });
  for (var i = 0; i < dd.length; i++) {
    var r = Array.prototype.filter.call(dd[i].childNodes, function (c) { return c.nodeType === 1 && c.namespaceURI === Y; })[0];
    if (!r) continue;
    if (r.localName === 'ProxyAutoBoundsNode') { var rs = r.getElementsByTagNameNS(Y, 'Realizers')[0], all = Array.prototype.filter.call(rs.childNodes, function (c) { return c.nodeType === 1; }); r = all[parseInt(rs.getAttribute('active') || '0', 10)]; }
    return r.getElementsByTagNameNS(Y, 'Geometry')[0];
  }
  return null;
}
// moves as the editor makes them, on the GraphML's own text
function moved(g, seed) {
  var r = rnd(seed), doc = new DP().parseFromString(g, 'application/xml'), set = function (el, k, v) { el.setAttribute(k, String(v)); };
  var nodes = Array.prototype.slice.call(doc.getElementsByTagNameNS(G, 'node')).filter(geoOf);
  var shift = function (n, dx, dy) {   // a node, and a group with what it holds, as the editor moves them
    [n].concat(Array.prototype.slice.call(n.getElementsByTagNameNS(G, 'node'))).forEach(function (m) {
      var geo = geoOf(m); if (!geo) return;
      set(geo, 'x', F(geo.getAttribute('x')) + dx); set(geo, 'y', F(geo.getAttribute('y')) + dy);
    });
  };
  pick(r, nodes, 4).forEach(function (n) { shift(n, [-37.5, 12, 60.25][Math.floor(r() * 3)], [-20, 8.5, 33][Math.floor(r() * 3)]); });
  var edges = Array.prototype.slice.call(doc.getElementsByTagNameNS(G, 'edge'));
  var pts = Array.prototype.slice.call(doc.getElementsByTagNameNS(Y, 'Point'));
  pick(r, pts, 3).forEach(function (p) { set(p, 'x', F(p.getAttribute('x')) + 7); set(p, 'y', F(p.getAttribute('y')) - 11.5); });
  pick(r, edges, 2).forEach(function (e) {   // a bend added where there was none, or the bends taken out
    var path = e.getElementsByTagNameNS(Y, 'Path')[0], ps = path.getElementsByTagNameNS(Y, 'Point');
    if (ps.length) { while (ps.length) path.removeChild(ps[0]); return; }
    var q = doc.createElementNS(Y, 'y:Point'); set(q, 'x', 123.5); set(q, 'y', 77.25); path.appendChild(q);
  });
  var byId = {}; nodes.forEach(function (n) { byId[n.getAttribute('id')] = n; });
  var hub = function (id) { return byId[id] && isHub(byId[id]); };
  pick(r, edges.filter(function (e) { return !hub(e.getAttribute('target')); }), 2).forEach(function (e) {   // an end set on a side of its node
    var path = e.getElementsByTagNameNS(Y, 'Path')[0], geo = geoOf(byId[e.getAttribute('target')]);
    if (geo) { set(path, 'tx', 0); set(path, 'ty', -F(geo.getAttribute('height')) / 2); }
  });
  var procs = nodes.filter(function (n) { return hub(n.getAttribute('id')); });
  pick(r, procs, 2).forEach(function (n) {   // a process turned a quarter, its port ends with it
    var id = n.getAttribute('id');
    edges.forEach(function (e) {
      var path = e.getElementsByTagNameNS(Y, 'Path')[0];
      [['source', 'sx', 'sy'], ['target', 'tx', 'ty']].forEach(function (q) {
        if (e.getAttribute(q[0]) !== id) return;
        var x = F(path.getAttribute(q[1])), y = F(path.getAttribute(q[2]));
        set(path, q[1], -y); set(path, q[2], x);
      });
    });
  });
  return new X.XMLSerializer().serializeToString(doc);
}
function isHub(n) { var geo = geoOf(n); return !!geo && /sbgn\.(Process|Operator)$/.test(geo.parentNode.getAttribute('configuration') || ''); }
// the places of a GraphML: node boxes, edge bends, edge ends (as offsets), the processes and gates
function places(g) {
  var doc = new DP().parseFromString(g, 'application/xml'), N = {}, E = {}, H = {};
  Array.prototype.forEach.call(doc.getElementsByTagNameNS(G, 'node'), function (n) { if (isHub(n)) H[n.getAttribute('id')] = true; });
  Array.prototype.forEach.call(doc.getElementsByTagNameNS(G, 'node'), function (n) { var geo = geoOf(n); if (geo) N[n.getAttribute('id')] = ['x', 'y', 'width', 'height'].map(function (k) { return F(geo.getAttribute(k)); }); });
  Array.prototype.forEach.call(doc.getElementsByTagNameNS(G, 'edge'), function (e) {
    var p = e.getElementsByTagNameNS(Y, 'Path')[0];
    E[e.getAttribute('id')] = { s: e.getAttribute('source'), t: e.getAttribute('target'), off: ['sx', 'sy', 'tx', 'ty'].map(function (k) { return F(p.getAttribute(k)) || 0; }),
      pts: Array.prototype.map.call(p.getElementsByTagNameNS(Y, 'Point'), function (q) { return [F(q.getAttribute('x')), F(q.getAttribute('y'))]; }) };
  });
  return { N: N, E: E, H: H };
}
function near(a, b, tol) { return Math.abs(a - b) <= (tol || 1e-3); }
function compare(want, got) {   // what differs between the places the editor had and the converter reads back
  var A = places(want), B = places(got), bad = [];
  Object.keys(A.N).forEach(function (id) { if (!B.N[id] || !A.N[id].every(function (v, j) { return near(v, B.N[id][j]); })) bad.push('node ' + id); });
  Object.keys(A.E).forEach(function (id) {
    var a = A.E[id], b = B.E[id];
    if (!b) { bad.push('edge ' + id + ' gone'); return; }
    if (a.pts.length !== b.pts.length || !a.pts.every(function (p, j) { return near(p[0], b.pts[j][0]) && near(p[1], b.pts[j][1]); })) bad.push('edge ' + id + ' bends');
    [0, 2].forEach(function (k) {
      var id2 = k ? a.t : a.s, box = A.N[id2]; if (!box) return;
      var same = near(a.off[k], b.off[k]) && near(a.off[k + 1], b.off[k + 1]);
      if (same) return;
      // an end on the line toward its next point reads as the centre: drawn the same
      var c = [box[0] + box[2] / 2, box[1] + box[3] / 2], aim = k ? (a.pts.length ? a.pts[a.pts.length - 1] : null) : (a.pts[0] || null);
      if (!aim) { var o = A.N[k ? a.s : a.t]; aim = [o[0] + o[2] / 2 + a.off[k ? 0 : 2], o[1] + o[3] / 2 + a.off[k ? 1 : 3]]; }
      var u = [aim[0] - c[0], aim[1] - c[1]], v = [a.off[k], a.off[k + 1]], n = Math.hypot(u[0], u[1]);
      var onLine = n && Math.abs(u[0] * v[1] - u[1] * v[0]) / n <= 1.5 && u[0] * v[0] + u[1] * v[1] >= 0;
      // read as the centre: drawn the same at any glyph but a process or gate (there the centre lets the renderer place the port)
      if (!b.off[k] && !b.off[k + 1] && !A.H[id2]) return;
      if (!(onLine && !b.off[k] && !b.off[k + 1])) bad.push('edge ' + id + (k ? ' target' : ' source') + ' end ' + a.off.slice(k, k + 2) + ' read as ' + b.off.slice(k, k + 2));
    });
  });
  return bad;
}

// a variant of a file with one modifier aimed at a port of its process (the review, 2026-11-14: libsbgn's pd10105 has one;
// the converter reads such an end as the glyph's centre), written beside the files for the same checks
function aimedAtPort(t) {
  var doc = new DP().parseFromString(t.replace(/^\ufeff/, ''), 'application/xml'), ports = {};
  Array.prototype.forEach.call(doc.getElementsByTagName('*'), function (e) { if (e.localName === 'port') ports[e.parentNode.getAttribute('id')] = e.getAttribute('id'); });
  var a = Array.prototype.find.call(doc.getElementsByTagName('*'), function (e) { return e.localName === 'arc' && /catalysis|stimulation|modulation|inhibition/.test(e.getAttribute('class')) && ports[e.getAttribute('target')]; });
  if (!a) return null;
  var m = t.indexOf('id="' + a.getAttribute('id') + '"'), tag = t.lastIndexOf('<', m), end = t.indexOf('>', m);
  return t.slice(0, tag) + t.slice(tag, end).replace('target="' + a.getAttribute('target') + '"', 'target="' + ports[a.getAttribute('target')] + '"') + t.slice(end);
}
var tmp0 = fs.mkdtempSync(path.join(os.tmpdir(), 'sbgn-aim-'));
files.slice().forEach(function (f, i) {
  if (!/test-maps/.test(f)) return;
  var v = aimedAtPort(fs.readFileSync(f, 'utf8'));
  if (v) { var q = path.join(tmp0, i + '-' + path.basename(f)); fs.writeFileSync(q, v); files.push(q); }
});
var rel = function (f) { return path.relative(here, f); };
var g0 = conv(files), fails = 0, runs = 0, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbgn-edit-'));
var later = [];
files.forEach(function (f, i) {
  if (!g0[i]) { console.log('skip (converter refuses): ' + rel(f)); return; }
  var s = fs.readFileSync(f, 'utf8'), say = function (m) { fails++; console.log('FAIL ' + rel(f) + ': ' + m); };
  try {
    if (se.graphml(s, g0[i], opt) !== g0[i]) say('graphml(s, conv(s)) is not conv(s)');
    if (se.write(s, g0[i], opt) !== s) say('write(s, conv(s)) is not s');
    for (var seed = 1; seed <= 3; seed++) {
      var g1 = moved(g0[i], seed * 7919 + i), s1 = se.write(s, g1, opt), p = path.join(tmp, i + '-' + seed + path.extname(f));
      fs.writeFileSync(p, s1);
      later.push({ f: f, p: p, g1: g1, s1: s1, base: g0[i], s: s, seed: seed });
    }
  } catch (e) { say(e.stack.split('\n').slice(0, 3).join(' ')); }
  runs++;
});
var g2 = conv(later.map(function (x) { return x.p; }));
later.forEach(function (x, j) {
  var say = function (m) { fails++; console.log('FAIL ' + rel(x.f) + ' (moves ' + x.seed + '): ' + m); };
  if (!g2[j]) return say('the converter cannot read what was written');
  var bad = compare(x.g1, g2[j]);
  if (bad.length) say(bad.length + ' places differ: ' + bad.slice(0, 4).join('; '));
  var back = se.graphml(x.s1, x.base, opt);
  if (back !== g2[j]) { say('graphml(write(s, g), conv(s)) is not conv(write(s, g))'); if (process.env.DUMP) { fs.writeFileSync(process.env.DUMP + '-a', g2[j]); fs.writeFileSync(process.env.DUMP + '-b', back); process.exit(1); } }
});
fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(tmp0, { recursive: true, force: true });
console.log(runs + ' SBGN-ML maps, ' + later.length + ' runs with moves: ' + (fails ? fails + ' failures' : 'all the same'));
process.exit(fails ? 1 : 0);
