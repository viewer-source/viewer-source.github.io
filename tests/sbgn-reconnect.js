// sbgn_edit.js with a line's end moved to another glyph, as the editor's reconnect (core.js) writes it into the
// GraphML: each kind of move the editor allows (an entity end to another entity, a consumption's process end to
// another process or to a gate, a gate input's end to a process or to another gate, a production's process end, a
// modulation's process end, a modulation leaving a gate) written into the SBGN-ML text, then read back by the
// converter: the same ends, ports and arrows, no other line changed, graphml(write) the converter's GraphML of it,
// write of that the same text. Ports from the yEd renderer, as the editor takes them.
//   node tests/sbgn-reconnect.js [python] [SBGN-ML files ...]   (default: python3; the Newt maps with gates, maps/sbgn-ml/, pd2af's gene activation)
var fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
var here = path.join(__dirname, '..');
var se = require(path.join(here, 'renderers/converter/sbgn_edit.js'));
var yr = require(path.join(here, 'renderers/yrender/yrender.js'));
var X = require(path.join(here, 'node_modules/@xmldom/xmldom')), DP = X.DOMParser, opt = { DOMParser: DP };
var Y = 'http://www.yworks.com/xml/graphml', G = 'http://graphml.graphdrawing.org/xmlns';
var DRIVER = ['import sys, json, contextlib, io','sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']',
  'from mapconv import sbgnml, graphml, report','out = []','for f in json.load(sys.stdin):','    try:',
  '        with report.collect(), contextlib.redirect_stdout(io.StringIO()): out.append(graphml.write(sbgnml.read(f)))',
  '    except Exception as e: out.append("ERR "+repr(e))','json.dump(out, sys.stdout)'].join('\n');
function conv(paths) { return JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(paths), maxBuffer: 1 << 30 }).toString()); }
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
function info(g) {
  var doc = new DP().parseFromString(g, 'application/xml'), N = {}, E = [];
  Array.prototype.forEach.call(doc.getElementsByTagNameNS(G, 'node'), function (n) {
    var geo = geoOf(n); if (!geo) return;
    var conf = (geo.parentNode.getAttribute('configuration') || '').replace('com.yworks.sbgn.', '');
    var par = n.parentNode && n.parentNode.parentNode, pid = par && par.localName === 'node' ? par.getAttribute('id') : null;
    N[n.getAttribute('id')] = { kind: conf || geo.parentNode.localName, box: ['x','y','width','height'].map(function(k){return +geo.getAttribute(k);}), up: pid, group: n.getAttribute('yfiles.foldertype') === 'group' };
  });
  Array.prototype.forEach.call(doc.getElementsByTagNameNS(G, 'edge'), function (e) {
    var ar = e.getElementsByTagNameNS(Y, 'Arrows')[0], p = e.getElementsByTagNameNS(Y, 'Path')[0];
    E.push({ id: e.getAttribute('id'), s: e.getAttribute('source'), t: e.getAttribute('target'), arr: [ar ? ar.getAttribute('source') : 'none', ar ? ar.getAttribute('target') : 'none'], off: ['sx','sy','tx','ty'].map(function(k){return +p.getAttribute(k)||0;}), pts: Array.prototype.map.call(p.getElementsByTagNameNS(Y, 'Point'), function (q) { return [+q.getAttribute('x'), +q.getAttribute('y')]; }) });
  });
  return { N: N, E: E };
}
function reconnect(g, eid, end, nid, off) {   // as the editor's reconnect, on the text
  var att = end ? 'target' : 'source', a = end ? ['tx','ty'] : ['sx','sy'];
  var i = g.indexOf('<edge id="' + eid + '"'); if (i < 0) throw 'no edge ' + eid;
  var tagEnd = g.indexOf('>', i), tag = g.slice(i, tagEnd + 1).replace(new RegExp('(\\s' + att + '=")[^"]*"'), '$1' + nid + '"');
  g = g.slice(0, i) + tag + g.slice(tagEnd + 1);
  var pi = g.indexOf('<y:Path', i), pe = g.indexOf('>', pi), pt = g.slice(pi, pe + 1);
  [[a[0], off[0]], [a[1], off[1]]].forEach(function (q) { var re = new RegExp('(\\s' + q[0] + '=")[^"]*"'); pt = re.test(pt) ? pt.replace(re, '$1' + q[1] + '"') : pt.replace(/(\/?>)$/, ' ' + q[0] + '="' + q[1] + '"$1'); });
  return g.slice(0, pi) + pt + g.slice(pe + 1);
}
var EPN = /^(Macromolecule|SimpleChemical|Complex|NucleicAcidFeature|UnspecifiedEntity|EmptySet|PerturbingAgent)$/, MODS = /^(white_circle|white_delta|white_delta_bar|t_shape|crows_foot_one|white_diamond)$/;
var args = process.argv.slice(2), py = args[0] && !/\.(sbgn|nwt)$|\//.test(args[0]) ? args.shift() : 'python3';
if (!args.length) args = ['test-maps/sbgn-ml/pd/newt-unstable', 'maps/sbgn-ml', 'test-maps/sbgn-ml/pd/pd2af-website/images/specification/gene_activation'].map(function (d) { d = path.join(here, d); return fs.existsSync(d) ? fs.readdirSync(d).filter(function (f) { return /\.(sbgn|nwt)$/.test(f); }).map(function (f) { return path.join(d, f); }) : []; }).reduce(function (a, b) { return a.concat(b); }, []);
var files = args, bad = 0, base = conv(files), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-')), later = [];
files.forEach(function (f, fi) {
  var s = fs.readFileSync(f, 'utf8'), g0 = base[fi]; if (/^ERR/.test(g0)) { console.log('skip', f, g0); return; }
  var I = info(g0), ports = yr.render(g0, { DOMParser: DP }).ports;
  var role = function (id) { var n = I.N[id]; if (!n) return null; if (n.up && I.N[n.up] && I.N[n.up].kind === 'Complex') return null; if (n.kind === 'Process') return 'proc'; if (n.kind === 'Operator') return 'gate'; return EPN.test(n.kind) ? 'epn' : n.kind === 'Phenotype' ? 'pheno' : null; };
  var ids = Object.keys(I.N), c = function (id) { var b = I.N[id].box; return [b[0] + b[2]/2, b[1] + b[3]/2]; };
  var cases = [];
  var procs = ids.filter(function (i) { return role(i) === 'proc'; }), gates = ids.filter(function (i) { return role(i) === 'gate'; }), epns = ids.filter(function (i) { return role(i) === 'epn'; });
  I.E.forEach(function (e) {
    if (e.arr[0] !== 'none') return;
    if (e.arr[1] === 'none' && role(e.t) === 'proc') {
      var p2 = procs.filter(function (p) { return p !== e.t && ports[p]; })[0];
      if (p2 && !cases.some(function (x) { return x.n === 'B'; })) cases.push({ n: 'B', e: e.id, end: 1, to: p2, off: [ports[p2][0][0] - c(p2)[0], ports[p2][0][1] - c(p2)[1]] });
      var g2 = gates.filter(function (p) { return ports[p]; })[0];
      if (g2 && role(e.s) === 'epn' && !cases.some(function (x) { return x.n === 'C'; })) cases.push({ n: 'C', e: e.id, end: 1, to: g2, off: [ports[g2][0][0] - c(g2)[0], ports[g2][0][1] - c(g2)[1]] });
      var e2 = epns.filter(function (p) { return p !== e.s; })[0];
      if (e2 && !cases.some(function (x) { return x.n === 'A'; })) cases.push({ n: 'A', e: e.id, end: 0, to: e2, off: [0, 0] });
    }
    if (e.arr[1] === 'none' && role(e.t) === 'gate' && role(e.s) === 'epn') {
      var p3 = procs.filter(function (p) { return ports[p]; })[0];
      if (p3 && !cases.some(function (x) { return x.n === 'F'; })) cases.push({ n: 'F', e: e.id, end: 1, to: p3, off: [ports[p3][0][0] - c(p3)[0], ports[p3][0][1] - c(p3)[1]] });
    }
    if (e.arr[1] === 'none' && role(e.t) === 'gate' && role(e.s) === 'epn') {
      var g4 = gates.filter(function (p) { return p !== e.t && ports[p]; })[0];
      if (g4 && !cases.some(function (x) { return x.n === 'G'; })) cases.push({ n: 'G', e: e.id, end: 0, to: g4, off: [ports[g4][1][0] - c(g4)[0], ports[g4][1][1] - c(g4)[1]] });
    }
    if (MODS.test(e.arr[1]) && role(e.s) === 'epn') {
      var g5 = gates.filter(function (p) { return ports[p]; })[0];
      if (g5 && !cases.some(function (x) { return x.n === 'H'; })) cases.push({ n: 'H', e: e.id, end: 0, to: g5, off: [ports[g5][1][0] - c(g5)[0], ports[g5][1][1] - c(g5)[1]] });
    }
    if (e.arr[1] === 'delta' && role(e.s) === 'proc') {
      var p4 = procs.filter(function (p) { return p !== e.s && ports[p]; }).slice(-1)[0];
      if (p4 && !cases.some(function (x) { return x.n === 'D'; })) cases.push({ n: 'D', e: e.id, end: 0, to: p4, off: [ports[p4][1][0] - c(p4)[0], ports[p4][1][1] - c(p4)[1]] });
    }
    if (MODS.test(e.arr[1]) && role(e.t) === 'proc') {
      var p5 = procs.filter(function (p) { return p !== e.t && ports[p]; }).slice(-1)[0];
      if (p5 && !cases.some(function (x) { return x.n === 'E'; })) { var P = ports[p5], b = I.N[p5].box, hz = Math.abs(P[1][0]-P[0][0]) >= Math.abs(P[1][1]-P[0][1]); cases.push({ n: 'E', e: e.id, end: 1, to: p5, off: hz ? [0, -b[3]/2] : [-b[2]/2, 0] }); }
    }
  });
  cases.forEach(function (k, j) {
    try {
      var g1 = reconnect(g0, k.e, k.end, k.to, k.off), s1 = se.write(s, g1, opt), p = path.join(tmp, fi + '-' + k.n + path.extname(f));
      fs.writeFileSync(p, s1);
      later.push({ f: f, k: k, g1: g1, s1: s1, g0: g0, p: p });
    } catch (x) { bad++; console.log('THROW', f, k.n, x && x.stack || x); }
  });
});
var back = conv(later.map(function (x) { return x.p; }));
later.forEach(function (x, j) {
  var tag = path.basename(x.f) + ' ' + x.k.n + ' ' + x.k.e + '->' + x.k.to;
  if (/^ERR/.test(back[j])) { bad++; return console.log('FAIL', tag, 'converter', back[j]); }
  var A = info(x.g1), B = info(back[j]), ea = A.E.filter(function (e) { return e.id === x.k.e; })[0], eb = B.E.filter(function (e) { return e.id === x.k.e; })[0];
  var msgs = [];
  if (!eb) msgs.push('edge gone');
  else {
    if (ea.s !== eb.s || ea.t !== eb.t) msgs.push('ends ' + ea.s + '>' + ea.t + ' read ' + eb.s + '>' + eb.t);
    // an end the converter reads as the centre because it lies on the line toward its neighbour (sbgnml.at) is drawn the same
    var cen = function (id) { var b = A.N[id].box; return [b[0] + b[2] / 2, b[1] + b[3] / 2]; };
    var onLine = function (j) {
      var id = j ? ea.t : ea.s, c = cen(id), P = [c[0] + ea.off[2 * j], c[1] + ea.off[2 * j + 1]];
      var nb = ea.pts.length ? ea.pts[j ? ea.pts.length - 1 : 0] : (function () { var o = j ? ea.s : ea.t, q = cen(o); return [q[0] + ea.off[2 - 2 * j], q[1] + ea.off[3 - 2 * j]]; })();
      var u = [nb[0] - c[0], nb[1] - c[1]], v = [P[0] - c[0], P[1] - c[1]], n = Math.hypot(u[0], u[1]);
      return !eb.off[2 * j] && !eb.off[2 * j + 1] && n && Math.abs(u[0] * v[1] - u[1] * v[0]) / n <= 1.5 && u[0] * v[0] + u[1] * v[1] >= 0;
    };
    var d = ea.off.map(function (v, i) { return onLine(i >> 1) ? 0 : Math.abs(v - eb.off[i]); });
    if (d.some(function (v) { return v > 1e-3; })) msgs.push('off ' + ea.off.map(function(v){return v.toFixed(2);}) + ' read ' + eb.off.map(function(v){return v.toFixed(2);}));
    if (ea.arr.join() !== eb.arr.join()) msgs.push('arrows ' + ea.arr + ' read ' + eb.arr);
  }
  // other edges unchanged?
  A.E.forEach(function (e, i) { var b = B.E.filter(function (q) { return q.id === e.id; })[0]; if (e.id === x.k.e || !b) return;
    if (e.s !== b.s || e.t !== b.t) msgs.push('other ' + e.id + ' ends changed');
    if (e.off.some(function (v, i2) { return Math.abs(v - b.off[i2]) > 1e-3; })) msgs.push('other ' + e.id + ' off ' + e.off.map(function(v){return v.toFixed(1);}) + ' -> ' + b.off.map(function(v){return v.toFixed(1);})); });
  var gb = se.graphml(x.s1, x.g0, opt);
  if (gb !== back[j]) msgs.push('graphml(write) != conv(write)');
  var w2 = se.write(x.s1, back[j], opt); if (w2 !== x.s1) msgs.push('write(s1, conv(s1)) != s1');
  var arc = x.s1.match(new RegExp('<arc[^>]*id="' + x.k.e + '"[^>]*>'));
  if (msgs.length) bad++;
  if (msgs.length || process.env.VERBOSE) console.log(msgs.length ? 'DIFF' : 'ok  ', tag, arc ? arc[0] : '', msgs.slice(0, 6).join(' | '));
});
console.log(later.length + ' moves on ' + files.length + ' maps: ' + (bad ? bad + ' wrong' : 'all right'));
process.exit(bad ? 1 : 0);
