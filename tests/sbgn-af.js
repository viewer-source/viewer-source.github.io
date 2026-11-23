// An Activity Flow map saved as SBGN Activity Flow, sbgn_edit.js against the converter
// (renderers/converter/mapconv, Python), on the demo's AF SBGN-ML files and on an empty map, as the editor makes things
// under AF: an activity of each kind of the palette (Activity with no unit, protein, metabolite, nucleic acid feature,
// complex, unspecified entity), influences between them, a file's activity given another unit and one with its unit
// taken off, a file's influence made another. Then s2 = write(s, g2). Checks:
//   1. the converter's GraphML of s2 is drawn by yrender exactly as g2, and graphml(s2, conv(s)) too (a reopened draft);
//   2. write(s2, conv(s2)) is s2 (the written file is stable);
//   3. the file is Activity Flow (an empty map marked language="activity flow"), the made glyphs biological activities whose unit holds only
//      the entity (no label, none typed), none on Activity; the influences under AF's names; the file's own classes kept; a plain
//      entity made written as its activity, a perturbing agent as a perturbation; a unit changed keeps its text, one taken
//      off goes whole; a file activity resized has its unit at afUnitBox, one restyled its fill. The unit's text:
//      a nucleic acid feature's activity made with ct:gene, a protein's given text (entity macromolecule, as
//      SBGN-ML requires one), a file activity's text typed, another's removed (its entity kept).
//   4. sbgn_edit.mapKind on small maps (the one master of what a map is), what only PD has included.
//   5. the map following what it holds: an empty map turned AF by an influence (also from its saved PD file), back to
//      PD (hybrid) by a process, kept hybrid by a state variable or a text unit, turned back by a state variable on an activity (below).
//   node tests/sbgn-af.js [python] [SBGN-ML files or folders ...]   (default: python3; test-maps/sbgn-ml/af)
var fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
var here = path.join(__dirname, '..'), se = require(path.join(here, 'renderers/converter/sbgn_edit.js'));
var yr = require(path.join(here, 'renderers/yrender/yrender.js'));
var X = require('@xmldom/xmldom'), DP = X.DOMParser, opt = { DOMParser: DP };
var U = require('./lib/untouched.js');
var args = process.argv.slice(2), py = args[0] && !/\.(sbgn|nwt)$|\//.test(args[0]) && !fs.existsSync(args[0]) ? args.shift() : 'python3';
var files = [];
(args.length ? args : ['test-maps/sbgn-ml/af'].map(function (p) { return path.join(here, p); })).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules|validation)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.(sbgn|nwt)$/.test(p)) files.push(p);
});
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbgn-af-'));
var EMPTY = path.join(tmp, 'empty.sbgn');   // a new map of the reader's (own.js)
fs.writeFileSync(EMPTY, '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3">\n  <map id="map" language="process description">\n  </map>\n</sbgn>\n');
files.push(EMPTY);
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
function kid(el, name) { return Array.prototype.filter.call(el.childNodes, function (c) { return c.localName === name; })[0] || null; }
function bb(el) { var b = kid(el, 'bbox'); return ['x', 'y', 'w', 'h'].map(function (k) { return +b.getAttribute(k); }); }
function read(s) {   // the map's language, the glyphs (class, the first unit's entity and label, its box and the glyph's), the arcs' classes
  var doc = new DP().parseFromString(s.replace(/^﻿/, ''), 'application/xml'), g = {}, arcs = {};
  Array.prototype.forEach.call(doc.getElementsByTagNameNS('*', 'glyph'), function (q) {
    var u = Array.prototype.filter.call(q.childNodes, function (c) { return c.localName === 'glyph' && c.getAttribute('class') === 'unit of information'; })[0];
    g[q.getAttribute('id')] = { cls: q.getAttribute('class'), unit: u && kid(u, 'entity') ? kid(u, 'entity').getAttribute('name') : null, ulabel: !!(u && kid(u, 'label')), utext: u && kid(u, 'label') ? kid(u, 'label').getAttribute('text') : '', u: !!u,
      box: kid(q, 'bbox') ? bb(q) : null, ubox: u && kid(u, 'bbox') ? bb(u) : null };
  });
  Array.prototype.forEach.call(doc.getElementsByTagNameNS('*', 'arc'), function (a) { arcs[a.getAttribute('id')] = a.getAttribute('class'); });
  return { lang: doc.getElementsByTagNameNS('*', 'map')[0].getAttribute('language'), g: g, arcs: arcs };
}
var KINDS = [['mk_a0', ''], ['mk_a1', 'macromolecule'], ['mk_a2', 'simple chemical'], ['mk_a3', 'nucleic acid feature'], ['mk_a4', 'complex'], ['mk_a5', 'unspecified entity']];
var bases = conv(files), made = [], bad = 0;
files.forEach(function (f, i) {
  var g = bases[i];
  if (!g) return;
  var s = fs.readFileSync(f, 'utf8'), R = read(s), D = se.defaults(s, opt, 'biological activity'), g2 = g;
  var acts = se.activities(g, opt), own = Object.keys(acts).filter(function (id) { return R.g[id] && R.g[id].cls === 'biological activity'; });
  var x0 = 4000, y0 = 4000;
  KINDS.forEach(function (q, k) { g2 = se.add(g2, { id: q[0], cls: se.unitClass(q[1]), activity: q[1], label: 'A' + k, box: [x0 + 200 * k, y0, D.w, D.h], fill: D.fill, line: D.line, width: D.width, font: D.font }, opt); });
  g2 = se.connect(g2, 'mk_i1', 'mk_a0', 'mk_a1', 'stimulation', opt);
  g2 = se.connect(g2, 'mk_i2', 'mk_a1', 'mk_a2', 'inhibition', opt);
  g2 = se.connect(g2, 'mk_i3', 'mk_a2', 'mk_a3', 'modulation', opt);
  g2 = se.connect(g2, 'mk_i4', 'mk_a3', 'mk_a4', 'necessary stimulation', opt);
  var changed = own[0], removed = own.filter(function (id) { return acts[id]; })[1];
  if (changed) g2 = se.activity(g2, changed, acts[changed] === 'simple chemical' ? 'complex' : 'simple chemical', opt);
  if (removed) g2 = se.activity(g2, removed, '', opt);
  var sized = own.filter(function (id) { return acts[id] && id !== changed && id !== removed; })[0];
  if (sized) { var gb = g2.match(new RegExp('<node id="' + sized + '"[\\s\\S]*?<y:Geometry[^>]*>'))[0].match(/<y:Geometry[^>]*>/)[0], nb = ['x', 'y', 'width', 'height'].map(function (k) { return +new RegExp('\\s' + k + '="([^"]+)"').exec(gb)[1]; });
    g2 = se.resize(g2, sized, [nb[0], nb[1], nb[2] * 1.5, nb[3] * 1.5], opt); g2 = se.restyle(g2, sized, { fill: '#FFCC00' }, opt); }
  g2 = se.add(g2, { id: 'mk_t1', cls: se.unitClass('nucleic acid feature'), activity: 'nucleic acid feature', label: 'G', box: [x0 + 400, y0 + 200, D.w, D.h], font: D.font, units: ['ct:gene'] }, opt);
  g2 = se.add(g2, { id: 'mk_t2', cls: se.unitClass(''), activity: '', label: 'P2', box: [x0 + 600, y0 + 200, D.w, D.h], font: D.font }, opt);
  g2 = se.unit(g2, 'mk_t2', 'TP53', opt);
  var typed = own.filter(function (id) { return acts[id] && id !== changed && id !== removed && id !== sized && !R.g[id].utext; })[0];
  if (typed) g2 = se.unit(g2, typed, 'ct:mRNA', opt);
  var untext = own.filter(function (id) { return R.g[id].utext && id !== changed && id !== removed && id !== sized; })[0];
  if (untext) g2 = se.unitDelete(g2, untext, 0, opt);
  g2 = se.add(g2, { id: 'mk_p', cls: 'perturbing agent', label: 'P', box: [x0, y0 + 200, 80, 40], font: D.font }, opt);
  g2 = se.add(g2, { id: 'mk_m', cls: 'macromolecule', label: 'M', box: [x0 + 200, y0 + 200, D.w, D.h], font: D.font }, opt);
  var finf = Object.keys(R.arcs).filter(function (k) { return R.arcs[k] === 'positive influence' && new RegExp('<edge id="' + k + '" ').test(g2); })[0];
  if (finf) g2 = se.arcKind(g2, finf, 'inhibition', opt);
  var s2 = se.write(s, g2, opt), p2 = path.join(tmp, i + '-2' + path.extname(f));
  fs.writeFileSync(p2, s2);
  made.push({ typed: typed, untext: untext, f: f, s: s, g: g, g2: g2, s2: s2, p2: p2, R: R, changed: changed, to: changed && (acts[changed] === 'simple chemical' ? 'complex' : 'simple chemical'), removed: removed, finf: finf, sized: sized });
});
var after = conv(made.map(function (m) { return m.p2; }));
made.forEach(function (m, i) {
  var name = m.f === EMPTY ? 'an empty map' : path.relative(here, m.f), c2 = after[i], why = [];
  if (!c2) why.push('the converter cannot read the file written');
  else {
    var want = d3(draw(c2));
    if (d3(draw(m.g2)) !== want) why.push('the editor\'s drawing differs from the converter\'s of the file written');
    if (d3(draw(se.graphml(m.s2, m.g, opt))) !== want) why.push('graphml(s2, base) is drawn differently');
    if (se.write(m.s2, c2, opt) !== m.s2) why.push('write(s2, conv(s2)) is not s2');
  }
  var R = read(m.s2);
  if (!se.isAf(m.s2) || (m.f === EMPTY && R.lang !== 'activity flow')) why.push('not Activity Flow: language ' + R.lang);   // a file may say so by its version (SBGN-ML 0.3)
  KINDS.forEach(function (q) {
    var gl = R.g[q[0]];
    if (!gl || gl.cls !== 'biological activity' || gl.unit !== (q[1] || null) || gl.ulabel) why.push(q[0] + ' written as ' + JSON.stringify(gl));
  });
  [['mk_i1', 'positive influence'], ['mk_i2', 'negative influence'], ['mk_i3', 'unknown influence'], ['mk_i4', 'necessary stimulation']].forEach(function (q) { if (R.arcs[q[0]] !== q[1]) why.push(q[0] + ' written as ' + R.arcs[q[0]]); });
  Object.keys(m.R.g).forEach(function (id) { if (R.g[id] && R.g[id].cls !== m.R.g[id].cls) why.push('the file\'s ' + id + ' made ' + R.g[id].cls); });
  if (m.changed && R.g[m.changed].unit !== m.to) why.push(m.changed + '\'s unit ' + R.g[m.changed].unit + ', not ' + m.to);
  if (m.removed && R.g[m.removed].u) why.push(m.removed + '\'s unit not taken off');
  if (m.changed && R.g[m.changed].utext !== m.R.g[m.changed].utext) why.push(m.changed + '\'s unit text ' + JSON.stringify(R.g[m.changed].utext) + ', not the file\'s ' + JSON.stringify(m.R.g[m.changed].utext));
  if (!R.g.mk_t1 || R.g.mk_t1.unit !== 'nucleic acid feature' || R.g.mk_t1.utext !== 'ct:gene') why.push('the gene\'s activity written as ' + JSON.stringify(R.g.mk_t1));
  if (!R.g.mk_t2 || R.g.mk_t2.unit !== 'macromolecule' || R.g.mk_t2.utext !== 'TP53') why.push('the protein\'s activity with text written as ' + JSON.stringify(R.g.mk_t2));
  if (m.typed && (R.g[m.typed].utext !== 'ct:mRNA' || R.g[m.typed].unit !== m.R.g[m.typed].unit)) why.push(m.typed + ' typed: ' + JSON.stringify(R.g[m.typed]));
  if (m.untext && (R.g[m.untext].ulabel || R.g[m.untext].unit !== m.R.g[m.untext].unit)) why.push(m.untext + '\'s text removed: ' + JSON.stringify(R.g[m.untext]));
  if (R.g.mk_p.cls !== 'perturbation') why.push('the perturbation written as ' + R.g.mk_p.cls);
  if (R.g.mk_m.cls !== 'biological activity' || R.g.mk_m.u) why.push('the plain macromolecule written as ' + JSON.stringify(R.g.mk_m));
  if (m.sized) {
    var sg = R.g[m.sized], ab = se.afUnitBox(sg.box, sg.unit, sg.utext);
    if (!sg.ubox || sg.ubox.some(function (v, j) { return Math.abs(v - ab[j]) > 1e-3; })) why.push(m.sized + ' resized: its unit at ' + JSON.stringify(sg.ubox) + ', not ' + JSON.stringify(ab));
    if (!/FFCC00|ffcc00/.test(m.s2)) why.push(m.sized + ' restyled: no fill written');
  }
  if (m.finf && R.arcs[m.finf] !== 'negative influence') why.push('the file\'s influence ' + m.finf + ' written as ' + R.arcs[m.finf]);
  if (why.length) { bad++; console.log('DIFFERENT ' + name + ': ' + why.join('; ')); }
});
// 5. the map follows what it holds (a direct link makes it Activity Flow, a process added afterwards makes it Process
// Description again, hybrid):
// two proteins and a metabolite drawn on an empty map stay PD; an influence between the proteins turns the file AF (every
// entity its activity, a protein's with no unit), also from the saved PD file; a process added turns it back (the
// entities again, no units, PD's names and language: hybrid, the influence ending on an entity); an entity with a state
// variable or a text unit keeps it hybrid, nothing converted. Each step: drawn as the converter draws the file written,
// graphml(s2, base) alike, the file stable
var step = 0;
function steps(list) {   // [[name, s, g, g2], ...] -> the files written, checked against the converter
  var out = list.map(function (q) { return se.write(q[1], q[3], opt); }), ps = out.map(function (x) { var f = path.join(tmp, 'k' + (step++) + '.sbgn'); fs.writeFileSync(f, x); return f; }), C = conv(ps);
  out.forEach(function (x, i) {
    var why = [], c = C[i], q = list[i];
    if (!c) why.push('the converter cannot read it');
    else {
      var want = d3(draw(c)), ed = q[3];
      if (se.isAf(x) !== se.isAf(q[4] || q[1])) {   // the file turned (toAf, toPd; q[4]: the file before this change, if not the base): the editor's GraphML made again from it (create.js sbFollow), written back the same
        ed = se.graphml(x, q[3], opt);
        if (se.write(q[1], ed, opt) !== x) why.push('write(s, graphml(s2, g2)) is not s2');
      }
      if (d3(draw(ed)) !== want) why.push('the editor\'s drawing differs from the converter\'s of the file written');
      if (d3(draw(se.graphml(x, q[2], opt))) !== want) why.push('graphml(s2, base) is drawn differently');
      if (se.write(x, c, opt) !== x) why.push('write(s2, conv(s2)) is not s2');
    }
    if (why.length) { bad++; console.log('DIFFERENT ' + q[0] + ': ' + why.join('; ')); }
  });
  return out.map(function (x, i) { return [x, C[i]]; });
}
var E0 = fs.readFileSync(EMPTY, 'utf8'), g0 = conv([EMPTY])[0], DM = se.defaults(E0, opt, 'macromolecule'), DC = se.defaults(E0, opt, 'simple chemical'), DP0 = se.defaults(E0, opt, 'process');
var two = se.add(se.add(se.add(g0, { id: 'p1', cls: 'macromolecule', label: 'RAF', box: [0, 0, DM.w, DM.h], font: DM.font }, opt),
  { id: 'p2', cls: 'macromolecule', label: 'MEK', box: [0, 200, DM.w, DM.h], font: DM.font }, opt), { id: 'p3', cls: 'simple chemical', label: 'ATP', box: [300, 0, DC.w, DC.h], font: DC.font }, opt);
// a New map's glyphs take the Default colours (sbgn_edit FILL), the viewer's SCHEMES.default the same
var SCH = /'default': '([^']+)'/.exec(fs.readFileSync(path.join(here, '_includes/atlas-app.html'), 'utf8'))[1].split(' ');
if (DM.fill !== '#' + SCH[2] || DC.fill !== '#' + SCH[3] || !DM.fallback || se.fillFor('compartment') !== '#' + SCH[0]) { bad++; console.log('DIFFERENT the Default colours: a New map\'s protein ' + DM.fill + ', metabolite ' + DC.fill + ', the viewer\'s ' + SCH.join(' ')); }
var linked = se.connect(two, 'i1', 'p1', 'p2', 'stimulation', { DOMParser: DP, sbgn: E0 });
var W1 = steps([['two proteins and a metabolite on an empty map', E0, g0, two], ['an influence drawn on the empty map', E0, g0, linked]]);
var pdFile = W1[0][0], afNew = W1[1][0], kc = 0;
var expect = function (name, s, lang, cls, arcs, kind) {
  var R = read(s), why = [];
  if (R.lang !== lang) why.push('language ' + R.lang);
  Object.keys(cls).forEach(function (id) { var g = R.g[id], w = cls[id]; if (!g || g.cls !== w[0] || g.unit !== w[1] || (w[0] !== 'biological activity' && g.u !== !!w[2]) || g.ulabel !== !!w[2]) why.push(id + ' ' + JSON.stringify(g)); });
  Object.keys(arcs).forEach(function (id) { if (R.arcs[id] !== arcs[id]) why.push(id + ' ' + R.arcs[id]); });
  if (se.mapKind(s) !== kind) why.push('mapKind ' + se.mapKind(s));
  kc++;
  if (why.length) { bad++; console.log('DIFFERENT ' + name + ': ' + why.join('; ')); }
};
expect('entities alone', pdFile, 'process description', { p1: ['macromolecule', null], p2: ['macromolecule', null], p3: ['simple chemical', null] }, {}, 'pd');
var ACTS = { p1: ['biological activity', null], p2: ['biological activity', null], p3: ['biological activity', 'simple chemical'] };
expect('an influence on the empty map', afNew, 'activity flow', ACTS, { i1: 'positive influence' }, 'af');
var gPd = W1[0][1], gAf = W1[1][1];
var fromPd = se.connect(gPd, 'i1', 'p1', 'p2', 'stimulation', { DOMParser: DP, sbgn: pdFile });
var withSv = se.connect(se.state(gPd, 'p1', 'P', 0.5, -0.5, opt), 'i1', 'p1', 'p2', 'stimulation', { DOMParser: DP, sbgn: pdFile });
var withUnit = se.connect(se.unit(gPd, 'p1', 'mt:prot', opt), 'i1', 'p1', 'p2', 'stimulation', { DOMParser: DP, sbgn: pdFile });
var so2 = { DOMParser: DP, sbgn: afNew }, proc = se.add(gAf, { id: 'pr', cls: 'process', label: '', box: [300, 200, DP0.w, DP0.h] }, opt);
proc = se.connect(se.connect(proc, 'c1', 'p3', 'pr', 'consumption', so2), 'c2', 'pr', 'p2', 'production', so2);
var W2 = steps([['an influence drawn on the saved PD file', pdFile, gPd, fromPd], ['a state variable and an influence', pdFile, gPd, withSv],
  ['a text unit and an influence', pdFile, gPd, withUnit], ['a process added to the AF file', afNew, gAf, proc], ['a state variable on an activity', afNew, gAf, se.state(gAf, 'p1', 'P', 0.5, -0.5, opt)],
  ['an activity\'s text, then a process', afNew, gAf, se.connect(se.connect(se.add(se.unit(gAf, 'p1', 'ct:gene', opt), { id: 'pr', cls: 'process', label: '', box: [300, 200, DP0.w, DP0.h] }, opt), 'c1', 'p3', 'pr', 'consumption', so2), 'c2', 'pr', 'p2', 'production', so2)]]);
expect('an activity\'s text (AF)', se.write(afNew, se.unit(gAf, 'p1', 'ct:gene', opt), opt), 'activity flow', { p1: ['biological activity', 'macromolecule', 1] }, { i1: 'positive influence' }, 'af');
expect('an influence on the saved PD file', W2[0][0], 'activity flow', ACTS, { i1: 'positive influence' }, 'af');
expect('a state variable kept', W2[1][0], 'process description', { p1: ['macromolecule', null], p2: ['macromolecule', null] }, { i1: 'stimulation' }, 'hybrid');
expect('a text unit kept', W2[2][0], 'process description', { p1: ['macromolecule', null, 1], p2: ['macromolecule', null] }, { i1: 'stimulation' }, 'hybrid');
expect('a state variable on an activity', W2[4][0], 'process description', { p1: ['macromolecule', null], p2: ['macromolecule', null], p3: ['simple chemical', null] }, { i1: 'stimulation' }, 'hybrid');
expect('an activity\'s text kept when a process turns it PD', W2[5][0], 'process description', { p1: ['macromolecule', null, 1], p2: ['macromolecule', null], p3: ['simple chemical', null] }, { i1: 'stimulation' }, 'hybrid');
expect('a process added to the AF file', W2[3][0], 'process description', { p1: ['macromolecule', null], p2: ['macromolecule', null], p3: ['simple chemical', null] }, { i1: 'stimulation', c1: 'consumption', c2: 'production' }, 'hybrid');
// 6. (1) the last process deleted turns the map back to AF, also in a draft reopened (the
// file's own kind measured before the deleted glyphs go); (2) a file turned is read again into the editor's GraphML: no
// activity left marked on a PD map, drawn as the converter draws the file, written back the same, on every AF file of the
// demo with a process added and deleted; (3) a PD file of entities
// and direct links (it reads AF) comes back as it was when saved with no change, and keeps its PD classes when changed;
// (4) a reopened draft's perturbing agent turned a perturbation carries the file's class
var gProc = W2[3][1], back = steps([['the process deleted again (a draft reopened)', W2[3][0], gProc, se.remove(se.graphml(W2[3][0], gProc, opt), ['pr'], opt)],
  ['the process deleted again (the same editing)', afNew, gAf, se.remove(se.graphml(W2[3][0], proc, opt), ['pr'], opt), W2[3][0]]]);
expect('the process deleted again (a draft reopened)', back[0][0], 'activity flow', ACTS, { i1: 'positive influence' }, 'af');
expect('the process deleted again (the same editing)', back[1][0], 'activity flow', ACTS, { i1: 'positive influence' }, 'af');
if (Object.keys(se.activities(se.graphml(W2[3][0], proc, opt), opt)).length) { bad++; console.log('DIFFERENT a process added: activities still marked in the editor\'s GraphML'); }
var turned = 0;
made.forEach(function (m, i) {
  var acts = Object.keys(se.activities(m.g, opt)).filter(function (id) { return new RegExp('<node id="' + id + '"').test(m.g); });
  if (m.f === EMPTY || acts.length < 2) return;
  var o = { DOMParser: DP, sbgn: m.s }, Dp = se.defaults(m.s, opt, 'process');
  var gp = se.add(m.g, { id: 'rv_pr', cls: 'process', label: '', box: [5000, 5000, Dp.w, Dp.h] }, opt);
  gp = se.connect(se.connect(gp, 'rv_c', acts[0], 'rv_pr', 'consumption', o), 'rv_p', 'rv_pr', acts[1], 'production', o);
  var name = path.relative(here, m.f), W = steps([[name + ', a process added', m.s, m.g, gp]]), ge = se.graphml(W[0][0], gp, opt);
  var W3 = steps([[name + ', the process deleted', m.s, m.g, se.remove(ge, ['rv_pr'], opt), W[0][0]]]);
  turned++;
  if (Object.keys(se.activities(ge, opt)).length || se.mapKind(W[0][0]) === 'af' || se.mapKind(W3[0][0]) !== 'af' || !se.isAf(W3[0][0])) { bad++; console.log('DIFFERENT ' + name + ': a process added and deleted reads ' + se.mapKind(W[0][0]) + ', ' + se.mapKind(W3[0][0])); }
});
// 7. the units an AF map holds kept through a process added and deleted (the GraphML made
// again from the PD file keeps each activity's unit, 'SBGN AF class'): a file activity's unit set by hand (not the base
// file's again), a new activity with a protein's unit, the file's own protein units (CaMKII's)
var unitsIn = function (s) { var R = read(s), o = {}; Object.keys(R.g).forEach(function (id) { if (R.g[id].cls === 'biological activity') o[id] = R.g[id].unit; }); return o; };
var keptUnits = 0;
[['test-maps/sbgn-ml/af/libsbgn/test-files/AF/AF_Reference_Card.sbgn', 'glyph8', 'complex'], ['test-maps/sbgn-ml/af/sbgn-website/downloads/figure_to_sbgn/camkii_Nov2014_AF.sbgn']].forEach(function (q) {
  var m = made.filter(function (x) { return x.f === path.join(here, q[0]); })[0];
  if (!m) return;
  var s = m.s, g = m.g, o = { DOMParser: DP, sbgn: s }, D = se.defaults(s, opt, 'biological activity'), Dp = se.defaults(s, opt, 'process'), name = path.basename(q[0]);
  var acts = Object.keys(se.activities(g, opt)).filter(function (id) { return new RegExp('<node id="' + id + '"').test(g); });
  var g1 = q[1] ? se.activity(g, q[1], q[2], opt) : g;
  g1 = se.add(g1, { id: 'rv_a', cls: 'macromolecule', activity: 'macromolecule', label: 'NEW', box: [6000, 6000, D.w, D.h], fill: D.fill, line: D.line, width: D.width, font: D.font }, opt);
  var W0 = steps([[name + ', a unit set and a protein activity made', s, g, g1]]);
  var gp = se.add(g1, { id: 'rv_pr', cls: 'process', label: '', box: [5000, 5000, Dp.w, Dp.h] }, opt);
  gp = se.connect(se.connect(gp, 'rv_c', acts[0], 'rv_pr', 'consumption', o), 'rv_p', 'rv_pr', acts[1], 'production', o);
  var W1 = steps([[name + ', then a process added', s, g, gp, W0[0][0]]]), ge = se.graphml(W1[0][0], gp, opt);
  var W3 = steps([[name + ', then the process deleted', s, g, se.remove(ge, ['rv_pr'], opt), W1[0][0]]]);
  var want = unitsIn(W0[0][0]), got = unitsIn(W3[0][0]), base = unitsIn(s), why = [];
  if (q[1] && want[q[1]] !== q[2]) why.push(q[1] + ' written ' + want[q[1]]);
  if (want.rv_a !== 'macromolecule') why.push('the new activity written ' + want.rv_a);
  if (!Object.keys(base).some(function (id) { return base[id] === 'macromolecule'; }) && !q[1]) why.push('no protein unit in the file');
  Object.keys(want).forEach(function (id) { if (got[id] !== want[id]) why.push(id + ' ' + want[id] + ' -> ' + got[id]); });
  if (!se.isAf(W3[0][0]) || se.isAf(W1[0][0])) why.push('languages ' + se.isAf(W1[0][0]) + ', ' + se.isAf(W3[0][0]));
  keptUnits++;
  if (why.length) { bad++; console.log('DIFFERENT ' + name + ', units through a process added and deleted: ' + why.join('; ')); }
});
// 8. Protein auxiliary unit (a tick box: the units of protein activities shown or not, the file written as
// shown): on CaMKII (every protein activity with the box) unticked, on EGFR (none)
// ticked: every protein activity then has the box, or none (other units untouched); a new protein activity made after
// follows (the palette's first sign: its unit macromolecule when ticked, none when not); ticked again, all back; each
// drawn as the converter draws the file written, the file stable
var protOf = function (s) { var o = unitsIn(s), r = { box: 0, none: 0, other: {} }; Object.keys(o).forEach(function (id) { if (o[id] === 'macromolecule') r.box++; else if (o[id] == null) r.none++; else r.other[id] = o[id]; }); return r; };
var boxes = 0;
[['test-maps/sbgn-ml/af/sbgn-website/downloads/figure_to_sbgn/camkii_Nov2014_AF.sbgn', true], ['test-maps/sbgn-ml/af/sbgn-website/downloads/examples/epidermal_growth_factor_receptor_pathway.sbgn', false]].forEach(function (q) {
  var m = made.filter(function (x) { return x.f === path.join(here, q[0]); })[0];
  if (!m) return;
  var s = m.s, g = m.g, name = path.basename(q[0]), P0 = protOf(s), why = [], D = se.defaults(s, opt, 'biological activity');
  if (q[1] ? P0.none || !P0.box : P0.box || !P0.none) why.push('the file\'s protein units ' + JSON.stringify(P0));
  var g1 = se.proteinBoxes(g, !q[1], opt);
  g1 = se.add(g1, { id: 'rv_pb', cls: 'macromolecule', activity: q[1] ? '' : 'macromolecule', label: 'NEW', box: [6000, 6000, D.w, D.h], fill: D.fill, line: D.line, width: D.width, font: D.font }, opt);
  var g2 = se.proteinBoxes(g1, q[1], opt);
  var W = steps([[name + ', Protein auxiliary unit ' + (q[1] ? 'unticked' : 'ticked') + ', a protein activity made', s, g, g1], [name + ', Protein auxiliary unit back', s, g, g2]]);
  var P1 = protOf(W[0][0]), P2 = protOf(W[1][0]);
  if (q[1] ? P1.box || P1.none !== P0.none + P0.box + 1 : P1.none || P1.box !== P0.none + P0.box + 1) why.push((q[1] ? 'unticked: ' : 'ticked: ') + JSON.stringify(P1));
  if (q[1] ? P2.none || P2.box !== P1.none : P2.box || P2.none !== P1.box) why.push('back: ' + JSON.stringify(P2));
  if (JSON.stringify(P1.other) !== JSON.stringify(P0.other) || JSON.stringify(P2.other) !== JSON.stringify(P0.other)) why.push('other units changed');
  if (se.write(s, g, opt) !== s) why.push('undone: not the file');
  if (q[1] && (D.fill !== null || D.fallback)) why.push('a new activity filled ' + D.fill + ' where the map\'s activities have no fill');   // (CaMKII's must not get the Default blue)
  if (q[1] && !/renderInformation/.test(s) && /renderInformation/.test(W[0][0])) why.push('colours added to a file with none');
  boxes++;
  if (why.length) { bad++; console.log('DIFFERENT ' + name + ', Protein auxiliary unit: ' + why.join('; ')); }
});
var LINKS = '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn:sbgn xmlns:sbgn="http://sbgn.org/libsbgn/0.3">\n  <sbgn:map id="m" language="process description">\n' +
  '    <sbgn:glyph class="macromolecule" id="a">\n      <sbgn:label text="RAF"/>\n      <sbgn:bbox x="50" y="50" w="80" h="40"/>\n    </sbgn:glyph>\n' +
  '    <sbgn:glyph class="complex" id="c">\n      <sbgn:label text="AB"/>\n      <sbgn:bbox x="300" y="50" w="100" h="60"/>\n    </sbgn:glyph>\n' +
  '    <sbgn:glyph class="perturbing agent" id="p">\n      <sbgn:label text="UV"/>\n      <sbgn:bbox x="50" y="250" w="80" h="40"/>\n    </sbgn:glyph>\n' +
  '    <sbgn:glyph class="simple chemical" id="s">\n      <sbgn:label text="ATP"/>\n      <sbgn:bbox x="300" y="250" w="40" h="40"/>\n    </sbgn:glyph>\n' +
  '    <sbgn:arc class="stimulation" id="e0" source="a" target="c">\n      <sbgn:start x="130" y="70"/>\n      <sbgn:end x="300" y="80"/>\n    </sbgn:arc>\n' +
  '    <sbgn:arc class="inhibition" id="e1" source="p" target="s">\n      <sbgn:start x="130" y="270"/>\n      <sbgn:end x="300" y="270"/>\n    </sbgn:arc>\n  </sbgn:map>\n</sbgn:sbgn>\n';
var LF = path.join(tmp, 'links.sbgn'); fs.writeFileSync(LF, LINKS);
var gL = conv([LF])[0];
if (se.mapKind(LINKS) !== 'af' || se.write(LINKS, gL, opt) !== LINKS) { bad++; console.log('DIFFERENT a PD file of direct links: ' + se.mapKind(LINKS) + ', saved unchanged ' + (se.write(LINKS, gL, opt) === LINKS)); }
// reduced notation in SBGN-ML (PD classes read as AF by their links) keeps its PD classes when edited, a new link
// written under PD's name (before, the first change turned it AF)
var WL = steps([['a PD file of direct links, a glyph moved', LINKS, gL, se.resize(gL, 's', [320, 250, 40, 40], opt)],
  ['a PD file of direct links, a link drawn', LINKS, gL, se.connect(gL, 'e2', 'a', 's', 'inhibition', { DOMParser: DP, sbgn: LINKS })]]);
var RN = { a: ['macromolecule', null], c: ['complex', null], p: ['perturbing agent', null], s: ['simple chemical', null] };
expect('a PD file of direct links, a glyph moved', WL[0][0], 'process description', RN, { e0: 'stimulation', e1: 'inhibition' }, 'af');
expect('a PD file of direct links, a link drawn', WL[1][0], 'process description', RN, { e0: 'stimulation', e1: 'inhibition', e2: 'inhibition' }, 'af');
// and nothing else in it changes (tests/lib/untouched.js, a named case): the glyph moved touches itself and its link,
// the link drawn only itself
[[WL[0][0], ['s', 'e1']], [WL[1][0], ['e2']]].forEach(function (q, k) {
  var u = U.diff(LINKS, q[0], q[1], opt);
  if (u.length) { bad++; console.log('DIFFERENT a PD file of direct links, ' + (k ? 'a link drawn' : 'a glyph moved') + ', untouched: ' + u.slice(0, 2).join('; ')); }
});
// an entity's activity unit chosen in the AF palette: written as the entity it names, once (the class was set twice)
['simple chemical', 'nucleic acid feature', 'unspecified entity'].forEach(function (u) {
  var W = steps([['a PD file of direct links, a unit set to ' + u, LINKS, gL, se.activity(gL, 'a', u, opt)]]);
  expect('a PD file of direct links, a unit set to ' + u, W[0][0], 'process description', Object.assign({}, RN, { a: [u, null] }), { e0: 'stimulation', e1: 'inhibition' }, 'af');
});
var propOf = function (g, id, name) {   // a node's property (its text), as the converter writes it
  var k = new RegExp('<key attr\\.name="' + name + '"[^>]*id="([^"]+)"').exec(g) || new RegExp('<key[^>]*id="([^"]+)"[^>]*attr\\.name="' + name + '"').exec(g), n = new RegExp('<node id="' + id + '"[\\s\\S]*?</node>').exec(g);
  var d = k && n && new RegExp('<data key="' + k[1] + '">([^<]*)</data>').exec(n[0]);
  return d ? d[1] : null;
};
var gLr = se.graphml(WL[0][0], gL, opt);
if (propOf(gLr, 'p', 'SBGN class') !== 'perturbing agent' || propOf(WL[0][1], 'p', 'SBGN class') !== 'perturbing agent') { bad++; console.log('DIFFERENT a reopened draft\'s perturbation: ' + propOf(gLr, 'p', 'SBGN class') + ', the converter ' + propOf(WL[0][1], 'p', 'SBGN class')); }
// 4. what a map is: the one master (create.js palKind and write() both read it)
var M = function (lang, body) { return '<sbgn><map' + (lang == null ? '' : ' language="' + lang + '"') + '>' + body + '</map></sbgn>'; };
var A = '<glyph id="a" class="biological activity"/><glyph id="b" class="biological activity"/><arc id="i" class="positive influence" source="a" target="b"/>';
var E = '<glyph id="a" class="macromolecule"/><glyph id="b" class="simple chemical"/>', P = '<glyph id="p" class="process"/>';
[[M('activity flow', ''), 'af'], [M('process description', ''), 'empty'], [M('hybrid any', A), 'af'], [M(null, A), 'af'], [M('process description', E), 'pd'],
 [M('process description', E + '<arc id="s" class="stimulation" source="a" target="b"/>'), 'af'], [M('process description', E + P), 'pd'],
 [M('process description', E + P + '<arc id="s" class="stimulation" source="a" target="b"/>'), 'hybrid'], [M('process description', E + '<glyph id="c" class="biological activity"/>'), 'af'],
 [M('process description', E + '<glyph id="f" class="phenotype"/><arc id="s" class="stimulation" source="a" target="f"/>'), 'pd'], [M(null, '<glyph id="k" class="compartment"/>'), 'empty'],
 // what only PD has keeps a map PD, or hybrid with a link ending on an entity
 [M('process description', '<glyph id="a" class="macromolecule"><glyph id="a1" class="state variable"><state value="P"/></glyph></glyph><glyph id="b" class="simple chemical"/>'), 'pd'], [M('activity flow', '<glyph id="a" class="macromolecule"><glyph id="a1" class="state variable"><state value="P"/></glyph></glyph><glyph id="b" class="simple chemical"/><arc id="s" class="stimulation" source="a" target="b"/>'), 'hybrid'],
 [M(null, '<glyph id="a" class="nucleic acid feature"><glyph id="u" class="unit of information"><label text="ct:mRNA"/></glyph></glyph><glyph id="b" class="macromolecule"/><arc id="s" class="inhibition" source="b" target="a"/>'), 'hybrid'],
 [M(null, '<glyph id="a" class="nucleic acid feature"><glyph id="u" class="unit of information"><label text=""/></glyph></glyph><glyph id="b" class="macromolecule"/><arc id="s" class="inhibition" source="b" target="a"/>'), 'af'],
 [M(null, '<glyph id="a" class="macromolecule multimer"/><glyph id="b" class="macromolecule"/><arc id="s" class="stimulation" source="b" target="a"/>'), 'hybrid'],
 [M(null, '<glyph id="a" class="complex"><glyph id="a1" class="macromolecule"/></glyph><glyph id="b" class="macromolecule"/><arc id="s" class="stimulation" source="b" target="a"/>'), 'hybrid'],
 [M(null, E + '<glyph id="z" class="source and sink"/><arc id="s" class="stimulation" source="a" target="b"/>'), 'hybrid'], [M('activity flow', A + P), 'hybrid'],
 [M('activity flow', '<glyph id="a" class="biological activity"/>' + P), 'pd'], [M('activity flow', '<glyph id="k" class="compartment"/>'), 'af'],
 [M('activity flow', '<glyph id="a" class="biological activity"><glyph id="a1" class="state variable"/></glyph>'), 'pd']].forEach(function (q, k) {
  var got = se.mapKind(q[0]);
  if (got !== q[1]) { bad++; console.log('DIFFERENT mapKind case ' + k + ': ' + got + ', not ' + q[1]); }
});
fs.rmSync(tmp, { recursive: true, force: true });
console.log(made.length + ' maps, activities of every kind and influences made, ' + made.filter(function (m) { return m.changed; }).length + ' file activities given another unit, ' +
  made.filter(function (m) { return m.removed; }).length + ' units taken off, ' + made.filter(function (m) { return m.finf; }).length + ' file influences switched, ' +
  made.filter(function (m) { return m.typed; }).length + ' unit texts typed, ' + made.filter(function (m) { return m.untext; }).length + ' removed, ' + kc + ' kind changes, ' + turned + ' maps given a process and back, ' + keptUnits + ' keeping their units, ' + boxes + ' given Protein auxiliary unit and back, ' + step + ' files of them: ' + (bad ? bad + ' different' : 'all the same'));
process.exit(bad ? 1 : 0);
