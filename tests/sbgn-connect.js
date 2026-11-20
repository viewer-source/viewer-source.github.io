// sbgn_edit.js's arcs (the full editor: consumption and production)
// against the converter (renderers/converter/mapconv, Python), on the demo's SBGN-ML maps, made as the editor makes them on
// its GraphML (g2): a bare process made right of the map, a consumption from a file's entity into it (its first arc: the
// axis), a production out of it to a simple chemical made with it; a second bare process between two made entities with a
// consumption and a production (the editor's entity-to-entity line), vertical; a consumption from a made entity into a
// file's process (its port in); a file's own arc deleted, and an arc made and deleted in the same editing. Then
// s2 = write(s, g2), the SBGN-ML file saved. Checks:
//   1. the converter's GraphML of s2 is drawn by yrender exactly as g2 (the editor shows what the file will hold);
//   2. graphml(s2, conv(s)) is drawn the same too (a draft reopened before the build: the base lacks the arcs);
//   3. write(s2, conv(s2)) is s2 (the written file is stable); the arcs at the right ports (.1 in, .2 out), the bare
//      processes with their ports and orientation, the deleted arcs gone.
//   node tests/sbgn-connect.js [python] [SBGN-ML files or folders ...]   (default: python3; maps/sbgn-ml, test-maps/sbgn-ml/pd)
var fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
var here = path.join(__dirname, '..'), se = require(path.join(here, 'renderers/converter/sbgn_edit.js'));
var yr = require(path.join(here, 'renderers/yrender/yrender.js'));
var X = require('@xmldom/xmldom'), DP = X.DOMParser, opt = { DOMParser: DP };
var args = process.argv.slice(2), py = args[0] && !/\.(sbgn|nwt)$|\//.test(args[0]) && !fs.existsSync(args[0]) ? args.shift() : 'python3';
var files = [];
(args.length ? args : ['maps/sbgn-ml', 'test-maps/sbgn-ml/pd', 'downloads'].map(function (p) { return path.join(here, p); })).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules|validation)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.(sbgn|nwt)$/.test(p) && !/-sbgnml\.sbgn$/.test(p)) files.push(p);
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
function draw(g) { return yr.render(g, { DOMParser: DP }).svg; }
function d3(svg) { return svg.replace(/-?\d+\.\d+/g, function (v) { return String(Math.round(parseFloat(v) * 1000) / 1000); }); }
function read(s) {   // the top-level glyphs [id, class, box, compartmentRef], the processes' ports and orientation, the arcs
  var doc = new DP().parseFromString(s.replace(/^﻿/, ''), 'application/xml'), g = [], arcs = {}, ports = {};
  Array.prototype.forEach.call(doc.getElementsByTagNameNS('*', 'glyph'), function (q) {
    var b = Array.prototype.filter.call(q.childNodes, function (c) { return c.localName === 'bbox'; })[0];
    ports[q.getAttribute('id')] = { o: q.getAttribute('orientation'), p: Array.prototype.filter.call(q.childNodes, function (c) { return c.localName === 'port'; }).map(function (c) { return c.getAttribute('id'); }) };
    if (b && q.parentNode.localName === 'map') g.push({ id: q.getAttribute('id'), cls: q.getAttribute('class'), box: ['x', 'y', 'w', 'h'].map(function (k) { return parseFloat(b.getAttribute(k)); }), cref: q.getAttribute('compartmentRef') });
  });
  Array.prototype.forEach.call(doc.getElementsByTagNameNS('*', 'arc'), function (a) { arcs[a.getAttribute('id')] = { cls: a.getAttribute('class'), s: a.getAttribute('source'), t: a.getAttribute('target') }; });
  return { g: g, arcs: arcs, ports: ports };
}
function r3(b) { return b.map(function (v) { return Math.round(v * 1000) / 1000; }); }
var EPN = /^(macromolecule|simple chemical|nucleic acid feature|unspecified entity|complex|perturbing agent|source and sink)( multimer)?$/;
var bases = conv(files), made = [], tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbgn-connect-')), bad = 0, ran = 0;
files.forEach(function (f, i) {
  var g = bases[i];
  if (!g) return;
  var s = fs.readFileSync(f, 'utf8'), R = read(s), all = R.g;
  var ent = all.filter(function (q) { return EPN.test(q.cls) && !q.cref && new RegExp('<node id="' + q.id + '"').test(g); })[0];
  var proc = all.filter(function (q) { return q.cls === 'process' && new RegExp('<node id="' + q.id + '"').test(g); })[0];
  var right = Math.max.apply(null, all.map(function (q) { return q.box[0] + q.box[2]; }).concat([0])), top = Math.min.apply(null, all.map(function (q) { return q.box[1]; }).concat([0]));
  var so = { DOMParser: DP, sbgn: s }, P = se.defaults(s, opt, 'process'), C = se.defaults(s, opt, 'simple chemical'), M = se.defaults(s, opt, 'macromolecule');
  var y0 = ent ? ent.box[1] + ent.box[3] / 2 : top + 100;
  // a bare process right of the map, level with the file's entity: its first arc a consumption from the entity (horizontal)
  var g2 = se.add(g, { id: 'mk_p1', cls: 'process', label: '', box: r3([right + 200, y0 - P.h / 2, P.w, P.h]) }, opt);
  g2 = se.add(g2, { id: 'mk_c1', cls: 'simple chemical', label: 'Made product', box: r3([right + 400, y0 - C.h / 2 + 30, C.w, C.h]), fill: C.fill, font: C.font }, opt);
  if (ent) g2 = se.connect(g2, 'mk_a1', ent.id, 'mk_p1', 'consumption', so);
  g2 = se.connect(g2, 'mk_a2', 'mk_p1', 'mk_c1', 'production', so);
  // two made entities with a process between them, consumption and production (the editor's entity-to-entity line), vertical
  g2 = se.add(g2, { id: 'mk_m1', cls: 'macromolecule', label: 'From', box: r3([right + 600, top, M.w, M.h]), fill: M.fill, font: M.font }, opt);
  g2 = se.add(g2, { id: 'mk_m2', cls: 'macromolecule', label: 'To', box: r3([right + 600, top + 200, M.w, M.h]), fill: M.fill, font: M.font }, opt);
  g2 = se.add(g2, { id: 'mk_p2', cls: 'process', label: '', box: r3([right + 640 - P.w / 2, top + 120 - P.h / 2, P.w, P.h]) }, opt);
  g2 = se.connect(g2, 'mk_a3', 'mk_m1', 'mk_p2', 'consumption', so);
  g2 = se.connect(g2, 'mk_a4', 'mk_p2', 'mk_m2', 'production', so);
  // the second link re-guesses: a production first to an entity down and left (horizontal by a little),
  // then a consumption from straight above: the process turned vertical, the production moved to the port below
  g2 = se.add(g2, { id: 'mk_m4', cls: 'macromolecule', label: 'Above', box: r3([right + 900 - M.w / 2, top, M.w, M.h]), fill: M.fill, font: M.font }, opt);
  g2 = se.add(g2, { id: 'mk_m5', cls: 'macromolecule', label: 'Below', box: r3([right + 680 - M.w / 2, top + 260, M.w, M.h]), fill: M.fill, font: M.font }, opt);
  g2 = se.add(g2, { id: 'mk_p3', cls: 'process', label: '', box: r3([right + 900 - P.w / 2, top + 120 - P.h / 2, P.w, P.h]) }, opt);
  g2 = se.connect(g2, 'mk_a7', 'mk_p3', 'mk_m5', 'production', so);
  var first3 = /<edge id="mk_a7"[\s\S]*?sx="([^"]*)" sy="([^"]*)"/.exec(g2);
  g2 = se.connect(g2, 'mk_a8', 'mk_m4', 'mk_p3', 'consumption', so);
  var then3 = /<edge id="mk_a7"[\s\S]*?sx="([^"]*)" sy="([^"]*)"/.exec(g2);
  if (!(+first3[1] < 0 && Math.abs(+first3[2]) < 1e-6 && Math.abs(+then3[1]) < 1e-6 && +then3[2] > 0)) throw new Error('second link not re-guessed: ' + first3.slice(1) + ' then ' + then3.slice(1));
  // two productions keep the first guess (re-guessed from the centre to their mean, they would turn across the flow)
  g2 = se.add(g2, { id: 'mk_m6', cls: 'macromolecule', label: 'East', box: r3([right + 1350 - M.w / 2, top + 400, M.w, M.h]), fill: M.fill, font: M.font }, opt);
  g2 = se.add(g2, { id: 'mk_m7', cls: 'macromolecule', label: 'West', box: r3([right + 1050 - M.w / 2, top + 410, M.w, M.h]), fill: M.fill, font: M.font }, opt);
  g2 = se.add(g2, { id: 'mk_p4', cls: 'process', label: '', box: r3([right + 1200 - P.w / 2, top + 400 + M.h / 2 - P.h / 2, P.w, P.h]) }, opt);
  g2 = se.connect(g2, 'mk_a9', 'mk_p4', 'mk_m6', 'production', so);
  g2 = se.connect(g2, 'mk_a10', 'mk_p4', 'mk_m7', 'production', so);
  // a made entity into a file's process: its port in, where the file has it
  if (proc) { g2 = se.add(g2, { id: 'mk_m3', cls: 'macromolecule', label: 'Into', box: r3([proc.box[0] - 200, proc.box[1] - 150, M.w, M.h]), fill: M.fill, font: M.font }, opt); g2 = se.connect(g2, 'mk_a5', 'mk_m3', proc.id, 'consumption', so); }
  // a file's arc deleted (one with both ends drawn), an arc made and deleted
  var gone = Object.keys(R.arcs).filter(function (k) { return new RegExp('<edge id="' + k + '" ').test(g) && (!proc || k.indexOf(proc.id) < 0) && [R.arcs[k].s, R.arcs[k].t].every(function (x) { return !ent || x.indexOf(ent.id) !== 0; }); })[0];
  if (gone) g2 = se.arcRemove(g2, [gone], opt);
  g2 = se.connect(g2, 'mk_a6', 'mk_m1', 'mk_p1', 'consumption', so);
  g2 = se.arcRemove(g2, ['mk_a6'], opt);
  // modulations and logic gates: an AND gate with two inputs, its output a stimulation of a process made
  // with its consumption and production; a catalysis from an entity onto that process, made an inhibition; a NOT gate's
  // output into the AND gate (gate into gate); the AND made an OR; an equivalence with two entities in and one out; a
  // stimulation of a phenotype; a modulation drawn first to a bare process from the left, its consumption then from the
  // left too (the antennas go vertical, clear of the modifier); a file's own modulation made a necessary stimulation
  var gx = right + 1600, G = se.defaults(s, opt, 'and'), mk = function (id, cls, lab, x, y, d) { d = d || M; g2 = se.add(g2, { id: id, cls: cls, label: lab, box: r3([x - d.w / 2, y - d.h / 2, d.w, d.h]), fill: d.fill, font: d.font }, opt); };
  mk('mk_m8', 'macromolecule', 'In one', gx, top); mk('mk_m9', 'macromolecule', 'In two', gx + 200, top);
  mk('mk_g1', 'and', '', gx + 100, top + 120, G);
  mk('mk_m10', 'simple chemical', 'Sub', gx - 100, top + 300, C); mk('mk_c2', 'simple chemical', 'Prod', gx + 300, top + 300, C);
  mk('mk_p5', 'process', '', gx + 100, top + 300, P);
  g2 = se.connect(g2, 'mk_a11', 'mk_m8', 'mk_g1', 'logic arc', so);
  g2 = se.connect(g2, 'mk_a12', 'mk_m9', 'mk_g1', 'logic arc', so);
  g2 = se.connect(g2, 'mk_a15', 'mk_m10', 'mk_p5', 'consumption', so);
  g2 = se.connect(g2, 'mk_a16', 'mk_p5', 'mk_c2', 'production', so);
  g2 = se.connect(g2, 'mk_a13', 'mk_g1', 'mk_p5', 'stimulation', so);
  mk('mk_m11', 'macromolecule', 'Enzyme', gx + 120, top + 450);
  g2 = se.connect(g2, 'mk_a14', 'mk_m11', 'mk_p5', 'catalysis', so);
  g2 = se.arcKind(g2, 'mk_a14', 'inhibition', opt);
  mk('mk_m12', 'macromolecule', 'Not in', gx - 200, top + 120); mk('mk_g3', 'not', '', gx - 60, top + 120, G);
  g2 = se.connect(g2, 'mk_a17', 'mk_m12', 'mk_g3', 'logic arc', so);
  g2 = se.connect(g2, 'mk_a18', 'mk_g3', 'mk_g1', 'logic arc', so);
  g2 = se.kind(g2, 'mk_g1', 'or', opt);
  mk('mk_m13', 'macromolecule', 'Form A', gx + 500, top); mk('mk_m14', 'macromolecule', 'Form B', gx + 700, top);
  mk('mk_g2', 'equivalence', '', gx + 600, top + 120, G); mk('mk_m15', 'macromolecule', 'Generic', gx + 600, top + 260);
  g2 = se.connect(g2, 'mk_a19', 'mk_m13', 'mk_g2', 'logic arc', so);
  g2 = se.connect(g2, 'mk_a20', 'mk_m14', 'mk_g2', 'logic arc', so);
  g2 = se.connect(g2, 'mk_a21', 'mk_g2', 'mk_m15', 'logic arc', so);
  mk('mk_ph', 'phenotype', 'Growth', gx + 400, top + 450, se.defaults(s, opt, 'phenotype'));
  g2 = se.connect(g2, 'mk_a22', 'mk_m11', 'mk_ph', 'stimulation', so);
  mk('mk_m16', 'macromolecule', 'Left mod', gx + 800, top + 400); mk('mk_m17', 'simple chemical', 'Left sub', gx + 800, top + 480, C);
  mk('mk_p6', 'process', '', gx + 1000, top + 440, P);
  g2 = se.connect(g2, 'mk_a23', 'mk_m16', 'mk_p6', 'modulation', so);
  g2 = se.connect(g2, 'mk_a24', 'mk_m17', 'mk_p6', 'consumption', so);
  // a modulation's side kept at the second link (stimulation from the left, consumption from above, production to the right)
  mk('mk_m18', 'macromolecule', 'Mod W', gx + 1200, top + 700); mk('mk_m19', 'simple chemical', 'Sub N', gx + 1400, top + 560, C); mk('mk_m20', 'simple chemical', 'Prod E', gx + 1600, top + 720, C);
  mk('mk_p7', 'process', '', gx + 1400, top + 700, P);
  g2 = se.connect(g2, 'mk_a25', 'mk_m18', 'mk_p7', 'stimulation', so);
  g2 = se.connect(g2, 'mk_a26', 'mk_m19', 'mk_p7', 'consumption', so);
  g2 = se.connect(g2, 'mk_a27', 'mk_p7', 'mk_m20', 'production', so);
  // Activity Flow (the palette's AF tab): an influence from one entity to another, a delay with one input
  // (a logic arc) and its output a positive influence to an entity, a negative influence between two entities
  mk('mk_m21', 'macromolecule', 'Kinase', gx + 1800, top); mk('mk_m22', 'macromolecule', 'Target', gx + 2000, top);
  mk('mk_g4', 'delay', '', gx + 1900, top + 150, G); mk('mk_m23', 'macromolecule', 'Late', gx + 1900, top + 300);
  g2 = se.connect(g2, 'mk_a28', 'mk_m21', 'mk_m22', 'stimulation', so);
  g2 = se.connect(g2, 'mk_a29', 'mk_m22', 'mk_g4', 'logic arc', so);
  g2 = se.connect(g2, 'mk_a30', 'mk_g4', 'mk_m23', 'stimulation', so);
  g2 = se.connect(g2, 'mk_a31', 'mk_m23', 'mk_m21', 'inhibition', so);
  var fmod = Object.keys(R.arcs).filter(function (k) { return /^(stimulation|catalysis|modulation|inhibition)$/.test(R.arcs[k].cls) && k !== gone && new RegExp('<edge id="' + k + '" ').test(g2); })[0];
  if (fmod) g2 = se.arcKind(g2, fmod, 'necessary stimulation', opt);
  var s2 = se.write(s, g2, opt), p2 = path.join(tmp, i + path.extname(f));
  fs.writeFileSync(p2, s2);
  made.push({ f: f, s: s, g: g, g2: g2, s2: s2, p2: p2, ent: ent, proc: proc, gone: gone, fmod: fmod });
});
var after = conv(made.map(function (m) { return m.p2; }));
made.forEach(function (m, i) {
  ran++;
  var name = path.relative(here, m.f), c2 = after[i], why = [];
  if (!c2) why.push('the converter cannot read the file written');
  else {
    var want = d3(draw(c2));
    if (d3(draw(m.g2)) !== want) why.push('the editor\'s drawing differs from the converter\'s of the file written');
    if (d3(draw(se.graphml(m.s2, m.g, opt))) !== want) why.push('graphml(s2, base) is drawn differently');
    if (se.write(m.s2, c2, opt) !== m.s2) why.push('write(s2, conv(s2)) is not s2');
  }
  var R = read(m.s2), A = R.arcs, want2 = [['mk_a2', 'production', 'mk_p1.2', 'mk_c1'], ['mk_a3', 'consumption', 'mk_m1', 'mk_p2.1'], ['mk_a4', 'production', 'mk_p2.2', 'mk_m2']];
  if (m.ent) want2.push(['mk_a1', 'consumption', m.ent.id, 'mk_p1.1']);
  want2.push(['mk_a11', 'logic arc', 'mk_m8', 'mk_g1.1'], ['mk_a12', 'logic arc', 'mk_m9', 'mk_g1.1'], ['mk_a13', 'stimulation', 'mk_g1.2', 'mk_p5'],
    ['mk_a14', 'inhibition', 'mk_m11', 'mk_p5'], ['mk_a17', 'logic arc', 'mk_m12', 'mk_g3.1'], ['mk_a18', 'logic arc', 'mk_g3.2', 'mk_g1.1'],
    ['mk_a19', 'logic arc', 'mk_m13', 'mk_g2.1'], ['mk_a21', 'logic arc', 'mk_g2.2', 'mk_m15'], ['mk_a22', 'stimulation', 'mk_m11', 'mk_ph'], ['mk_a23', 'modulation', 'mk_m16', 'mk_p6'],
    ['mk_a28', 'stimulation', 'mk_m21', 'mk_m22'], ['mk_a29', 'logic arc', 'mk_m22', 'mk_g4.1'], ['mk_a30', 'stimulation', 'mk_g4.2', 'mk_m23'], ['mk_a31', 'inhibition', 'mk_m23', 'mk_m21']);
  var cl = {}; R.g.forEach(function (q) { cl[q.id] = q.cls; });
  if (cl.mk_g1 !== 'or' || cl.mk_g2 !== 'equivalence' || cl.mk_g3 !== 'not' || cl.mk_g4 !== 'delay') why.push('gates written as ' + [cl.mk_g1, cl.mk_g2, cl.mk_g3, cl.mk_g4]);
  if (R.ports.mk_p7.o !== 'vertical') why.push('p7 turned onto its modifier\'s side at the second link (' + R.ports.mk_p7.o + ')');
  if (R.ports.mk_p6.o !== 'vertical') why.push('p6 not clear of its modifier (' + R.ports.mk_p6.o + ')');
  if (m.fmod && A[m.fmod].cls !== 'necessary stimulation') why.push('file modulation ' + m.fmod + ' not made a necessary stimulation (' + A[m.fmod].cls + ')');
  want2.forEach(function (q) { var a = A[q[0]]; if (!a || a.cls !== q[1] || a.s !== q[2] || a.t !== q[3]) why.push(q[0] + ' not written as a ' + q[1] + ' from ' + q[2] + ' to ' + q[3] + (a ? ' (' + [a.cls, a.s, a.t].join(' ') + ')' : '')); });
  if (m.proc) { var a5 = A.mk_a5, pin = (Object.keys(A).filter(function (k) { return k !== 'mk_a5' && A[k].cls === 'consumption' && R.ports[m.proc.id].p.indexOf(A[k].t) >= 0; }).map(function (k) { return A[k].t; })[0]);
    if (!a5 || a5.cls !== 'consumption' || (pin ? a5.t !== pin : R.ports[m.proc.id].p.indexOf(a5.t) < 0)) why.push('mk_a5 not at the file process\'s port in (' + (a5 && a5.t) + ', ' + pin + ')'); }
  if (R.ports.mk_p1.o !== 'horizontal' || R.ports.mk_p1.p.join() !== 'mk_p1.1,mk_p1.2') why.push('p1 not given its ports and orientation (' + R.ports.mk_p1.o + ' ' + R.ports.mk_p1.p + ')');
  if (R.ports.mk_p3.o !== 'vertical') why.push('p3 not turned vertical by its second link (' + R.ports.mk_p3.o + ')');
  if (R.ports.mk_p4.o !== 'horizontal') why.push('p4 turned by its second production (' + R.ports.mk_p4.o + ')');
  if (R.ports.mk_p2.o !== 'vertical' || R.ports.mk_p2.p.join() !== 'mk_p2.1,mk_p2.2') why.push('p2 not given its ports and orientation (' + R.ports.mk_p2.o + ' ' + R.ports.mk_p2.p + ')');
  if (m.gone && A[m.gone]) why.push('a deleted arc still in the file');
  if (A.mk_a6) why.push('an arc made and deleted written');
  if (why.length) { bad++; console.log('DIFFERENT ' + name + ': ' + why.join('; ')); }
});
fs.rmSync(tmp, { recursive: true, force: true });
console.log(ran + ' SBGN-ML maps, consumptions and productions made (' + made.filter(function (m) { return m.proc; }).length + ' into a file\'s process), ' +
  made.filter(function (m) { return m.gone; }).length + ' file arcs deleted, modulations and gates made, ' + made.filter(function (m) { return m.fmod; }).length + ' file modulations switched: ' + (bad ? bad + ' different' : 'all the same'));
process.exit(bad ? 1 : 0);
