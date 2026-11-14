// cd_edit with a line's end moved to another node, as the editor writes it into cd_edit's GraphML (the edge's source or
// target, its port at a side or the centre): on every CellDesigner map, for each kind of line that has one (the base
// reactant, the base product, a modifier, an added reactant, an added product), its end at a species moved to another
// species alias (never a member inside a complex, never a compartment). Checked: cd_edit.js and cd_edit.py write the
// same text byte for byte; the reaction now names the new species and alias in the CellDesigner element (a modifier's
// linkTarget too) and in SBML's reference; the GraphML made again from it has the line at the new node and every other
// line as before; the text reads as XML.
//   node tests/cd-reconnect.js [python] [CellDesigner files or folders ...]   (default: python3, maps/)
var fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), ed = require(path.join(here, 'renderers/converter/cd_edit.js'));
var DP = require('@xmldom/xmldom').DOMParser, opt = { DOMParser: DP };
var args = process.argv.slice(2), py = args[0] && !/\.xml$|\//.test(args[0]) && !fs.existsSync(args[0]) ? args.shift() : 'python3';
var files = [];
(args.length ? args : [path.join(here, 'maps')]).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.xml$/.test(p)) { var t = fs.readFileSync(p, 'utf8').slice(0, 3000); if (/<sbml[\s>]/.test(t) && t.indexOf('celldesigner') >= 0) files.push(p); }
});
var G = 'http://graphml.graphdrawing.org/xmlns', Y = 'http://www.yworks.com/xml/graphml';
function graph(g) {   // nodes (id -> its parent's kind) and edges (id -> [source, target])
  var d = new DP().parseFromString(g, 'application/xml'), N = {}, E = {};
  Array.prototype.forEach.call(d.getElementsByTagNameNS(G, 'node'), function (n) {
    var up = n.parentNode && n.parentNode.parentNode, grp = n.getAttribute('yfiles.foldertype') === 'group';
    var rs = grp && n.getElementsByTagNameNS(Y, 'Realizers')[0], r0 = rs && Array.prototype.filter.call(rs.childNodes, function (c) { return c.nodeType === 1; })[0];
    var cpx = !!(r0 && r0.localName === 'GenericGroupNode');   // its own realizer, not one of what it holds
    N[n.getAttribute('id')] = { group: grp, complex: cpx, comp: grp && !cpx, up: up && up.localName === 'node' ? up.getAttribute('id') : null };
  });
  Array.prototype.forEach.call(d.getElementsByTagNameNS(G, 'edge'), function (e) { E[e.getAttribute('id')] = [e.getAttribute('source'), e.getAttribute('target')]; });
  return { N: N, E: E };
}
function setEnd(g, eid, j, to, off) {   // as the editor's reconnect: the edge's source or target, its port offset
  var i = g.indexOf('<edge id="' + eid + '"'), te = g.indexOf('>', i), att = j ? 'target' : 'source', a = j ? ['tx', 'ty'] : ['sx', 'sy'];
  var tag = g.slice(i, te + 1).replace(new RegExp('(\\s' + att + '=")[^"]*"'), '$1' + to + '"');
  g = g.slice(0, i) + tag + g.slice(te + 1);
  var pi = g.indexOf('<y:Path', i), pe = g.indexOf('>', pi), pt = g.slice(pi, pe + 1);
  pt = pt.replace(new RegExp('(\\s' + a[0] + '=")[^"]*"'), '$1' + off[0] + '"').replace(new RegExp('(\\s' + a[1] + '=")[^"]*"'), '$1' + off[1] + '"');
  return g.slice(0, pi) + pt + g.slice(pe + 1);
}
var jobs = [];
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8'), g = ed.graphml(t, null, opt), I = graph(g);
  var ok = function (id) { var n = I.N[id]; return n && !/\|proc$/.test(id) && !n.comp && !(n.up && I.N[n.up] && I.N[n.up].complex); };
  var targets = Object.keys(I.N).filter(ok);
  var kinds = [[/\|a$/, 0, 'base reactant'], [/\|b$/, 1, 'base product'], [/\|m\d+$/, 0, 'modifier'], [/\|r\d+$/, 0, 'added reactant'], [/\|p\d+$/, 1, 'added product']];
  kinds.forEach(function (k, ki) {
    var eid = Object.keys(I.E).filter(function (e) { return k[0].test(e) && ok(I.E[e][k[1]]); })[0];
    if (!eid) return;
    var now = I.E[eid][k[1]], others = I.E[eid].concat(Object.keys(I.E).filter(function (e) { return e.split('|')[0] === eid.split('|')[0]; }).map(function (e) { return I.E[e]; }).reduce(function (a, b) { return a.concat(b); }, []));
    var to = targets.filter(function (x) { return others.indexOf(x) < 0; })[ki * 3 % Math.max(1, targets.length)];
    if (!to) return;
    jobs.push({ f: f, t: t, g0: g, kind: k[2], eid: eid, j: k[1], from: now, to: to, g1: setEnd(g, eid, k[1], to, ki % 2 ? ['0.0', '0.0'] : ['0.0', '-10.0']) });
  });
  // refused: an end put on a species the reaction already has (the editor refuses it; cd_edit leaves the participant)
  var a0 = Object.keys(I.E).filter(function (e) { return /\|a$/.test(e) && I.E[e.replace(/a$/, 'b')]; })[0];
  if (a0) { var pb = I.E[a0.replace(/a$/, 'b')][1]; jobs.push({ f: f, t: t, g0: g, kind: 'refused', eid: a0, j: 0, from: I.E[a0][0], to: pb, g1: setEnd(g, a0, 0, pb, ['0.0', '0.0']) }); }
});
var DRIVER = ['import sys, json', 'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']', 'import cd_edit', 'out = []',
  'for t, g in json.load(sys.stdin):', '    try: out.append(cd_edit.apply(t, g))', '    except Exception as e: out.append("ERR " + repr(e))', 'json.dump(out, sys.stdout)'].join('\n');
var pyOut = JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(jobs.map(function (j) { return [j.t, j.g1]; })), maxBuffer: 1 << 30 }).toString());
var bad = 0;
jobs.forEach(function (j, n) {
  var tag = path.basename(j.f) + ' ' + j.kind + ' ' + j.eid + ': ' + j.from + ' -> ' + j.to, msg = [], out;
  try { out = ed.apply(j.t, j.g1, opt); } catch (e) { msg.push('JavaScript: ' + (e && e.message || e)); }
  if (out !== undefined && out !== pyOut[n]) msg.push('JavaScript and Python differ' + (/^ERR/.test(pyOut[n]) ? ' (' + pyOut[n] + ')' : ''));
  if (out !== undefined && j.kind === 'refused') {
    var E0 = graph(j.g0).E, E1 = graph(ed.graphml(out, null, opt)).E;   // every line at the nodes it had (only the port of that end may change)
    if (Object.keys(E0).some(function (e) { return !E1[e] || E1[e].join() !== E0[e].join(); })) msg.push('a participant changed');
  } else if (out !== undefined) {
    var doc = new DP({ onError: function (l, m) { if (l !== 'warning') msg.push('XML: ' + m); } }).parseFromString(out, 'application/xml');
    var A = graph(ed.graphml(out, null, opt)), B = graph(j.g1);
    if (!A.E[j.eid] || A.E[j.eid][j.j] !== j.to) msg.push('read back at ' + (A.E[j.eid] && A.E[j.eid][j.j]));
    Object.keys(B.E).forEach(function (e) { if (e !== j.eid && (!A.E[e] || A.E[e].join() !== B.E[e].join())) msg.push('other line ' + e + ' changed'); });
    var rx = out.slice(out.indexOf('id="' + j.eid.split('|')[0] + '"'));
    rx = rx.slice(0, rx.indexOf('</reaction>'));
    if (rx.indexOf('<celldesigner:alias>' + j.to + '<') < 0) msg.push('SBML reference not moved to the new alias');
    // a catalysis: the species' lists of the reactions they catalyse follow, where the file keeps them
    var rid = j.eid.split('|')[0], sid = function (tt, al) { var m = new RegExp('Alias id="' + al + '"[^>]*species="([^"]*)"').exec(tt) || new RegExp('species="([^"]*)"[^>]*id="' + al + '"').exec(tt); return m && m[1]; };
    var cats = function (tt, s2) { var i = tt.indexOf('<species '), m = new RegExp('<species [^>]*\\bid="' + s2 + '"[\\s\\S]*?</species>').exec(tt); return m ? m[0].indexOf('<celldesigner:catalyzed reaction="' + rid + '"/>') >= 0 : false; };
    if (j.kind === 'modifier' && /type="(UNKNOWN_)?CATALYSIS"/.test(rx.slice(0, rx.indexOf('</celldesigner:modification>'))) && cats(j.t, sid(j.t, j.from))) {
      if (!cats(out, sid(out, j.to))) msg.push('the new species does not list the reaction it catalyses');
      if (cats(out, sid(j.t, j.from)) && (rx.match(/<celldesigner:modification /g) || []).length < 2) msg.push('the old species still lists the reaction');
      j.cat = true;
    }
  }
  if (msg.length) { bad++; console.log('DIFF', tag, '|', msg.slice(0, 4).join(' | ')); } else if (process.env.VERBOSE) console.log('ok  ', tag);
});
console.log(jobs.length + ' moves on ' + files.length + ' maps (' + jobs.filter(function (j) { return j.kind === 'refused'; }).length + ' refused, ' + jobs.filter(function (j) { return j.cat; }).length + ' catalyses with their lists): ' + (bad ? bad + ' wrong' : 'all right'));
process.exit(bad ? 1 : 0);
