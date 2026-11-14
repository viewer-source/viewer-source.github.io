// sbgn_edit.js's creating (the full editor, 2026-11-14) against the converter (renderers/converter/mapconv, Python), on
// the demo's SBGN-ML maps: a macromolecule added on the map and one in a compartment, named, with state variables (one
// with a site, one empty), an existing macromolecule renamed and a state variable's value changed, state variables moved
// and deleted, a macromolecule of the file deleted; a simple chemical made on the map and in a compartment, named, a state
// variable on it refused, a file's own simple chemical renamed and another deleted, as the editor makes
// them on its GraphML (g2); then s2 = write(s, g2), the SBGN-ML file saved. Checks:
//   1. the converter's GraphML of s2 is drawn by yrender exactly as g2 (the editor shows what the file will hold);
//   2. graphml(s2, conv(s)) is drawn the same too (a draft reopened before the build: the base lacks what was made);
//   3. write(s2, conv(s2)) is s2 (the written file is stable), and s2 holds the glyphs, names and values made.
//   node tests/sbgn-create.js [python] [SBGN-ML files or folders ...]   (default: python3; maps/sbgn-ml, test-maps/sbgn-ml/pd)
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
function draw(g) { var r = yr.render(g, { DOMParser: DP }); return r.svg; }
// a state variable moved on a glyph of the file is written to 4 decimals and read back as a ratio of its glyph's box, so
// its drawing may differ from the editor's in the 4th decimal: numbers compared to 3 decimals
function d3(svg) { return svg.replace(/-?\d+\.\d+/g, function (v) { return String(Math.round(parseFloat(v) * 1000) / 1000); }); }
function glyphs(s) {   // [id, class, box, compartmentRef, has a state variable] of the top-level glyphs
  var doc = new DP().parseFromString(s.replace(/^\ufeff/, ''), 'application/xml'), out = [];
  Array.prototype.forEach.call(doc.getElementsByTagNameNS('*', 'glyph'), function (g) {
    var b = Array.prototype.filter.call(g.childNodes, function (c) { return c.localName === 'bbox'; })[0];
    if (!b) return;
    out.push({ id: g.getAttribute('id'), cls: g.getAttribute('class'), top: g.parentNode.localName === 'map', box: ['x', 'y', 'w', 'h'].map(function (k) { return parseFloat(b.getAttribute(k)); }),
               sv: Array.prototype.some.call(g.childNodes, function (c) { return c.localName === 'glyph' && c.getAttribute('class') === 'state variable'; }),
               ui: Array.prototype.filter.call(g.childNodes, function (c) { return c.localName === 'glyph' && c.getAttribute('class') === 'unit of information'; }).map(function (c) { return c.getAttribute('id'); }) });
  });
  return out;
}
function svOf(s, id) {   // the ids of a glyph's state variables in the file
  var doc = new DP().parseFromString(s.replace(/^\ufeff/, ''), 'application/xml'), g = Array.prototype.filter.call(doc.getElementsByTagName('glyph'), function (x) { return x.getAttribute('id') === id; })[0];
  return g ? Array.prototype.filter.call(g.childNodes, function (c) { return c.localName === 'glyph' && c.getAttribute('class') === 'state variable'; }).map(function (c) { return c.getAttribute('id'); }) : [];
}
function r3(b) { return b.map(function (v) { return Math.round(v * 1000) / 1000; }); }   // places as the editor writes them (fmt)
var bases = conv(files), made = [], tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbgn-create-')), bad = 0, ran = 0;
files.forEach(function (f, i) {
  var g = bases[i];
  if (!g) return;
  var s = fs.readFileSync(f, 'utf8'), all = glyphs(s), D = se.defaults(s, opt);
  var right = Math.max.apply(null, all.map(function (q) { return q.box[0] + q.box[2]; }).concat([0])), top = Math.min.apply(null, all.map(function (q) { return q.box[1]; }).concat([0]));
  var g2 = se.add(g, { id: 'made1', cls: 'macromolecule', label: 'Made one', box: r3([right + 100, top, D.w, D.h]), fill: D.fill, font: D.font }, opt);
  g2 = se.state(g2, 'made1', 'P@S12', 0.25, -0.5, opt);
  g2 = se.state(g2, 'made1', '', -0.25, 0.5, opt);
  var comp = all.filter(function (q) { return q.cls === 'compartment' && q.top && q.box[2] > 2 * D.w && q.box[3] > 2 * D.h; })[0];
  if (comp) g2 = se.add(g2, { id: 'made2', cls: 'macromolecule', label: 'Made in a compartment', box: r3([comp.box[0] + 10, comp.box[1] + 10, D.w, D.h]), parent: comp.id, fill: D.fill, font: D.font, states: [['Ub', 0.5, 0]] }, opt);
  // simple chemicals (2026-11-14): one on the map, named; one in a compartment; a state variable asked for and refused
  // (the house profile); a file's own simple chemical renamed and another deleted
  var C = se.defaults(s, opt, 'simple chemical');
  g2 = se.add(g2, { id: 'chem1', cls: 'simple chemical', label: 'ATP', box: r3([right + 220, top, C.w, C.h]), fill: C.fill, font: C.font }, opt);
  var g2a = se.state(g2, 'chem1', 'P', 0, 0.5, opt);
  if (g2a !== g2) bad++, console.log('DIFFERENT ' + path.relative(here, f) + ': a state variable added to a simple chemical');
  if (comp) g2 = se.add(g2, { id: 'chem2', cls: 'simple chemical', label: '', box: r3([comp.box[0] + 10, comp.box[1] + 20 + D.h, C.w, C.h]), parent: comp.id, fill: C.fill, font: C.font }, opt);
  var chem = all.filter(function (q) { return q.cls === 'simple chemical' && q.top && !q.sv; });
  if (chem[0]) g2 = se.label(g2, chem[0].id, 'Renamed chemical', opt);
  if (chem[1]) g2 = se.remove(g2, [chem[1].id], opt);
  var mac = all.filter(function (q) { return q.cls === 'macromolecule'; });
  if (mac[0]) g2 = se.label(g2, mac[0].id, 'Renamed & <x>', opt);
  var withSv = mac.filter(function (q) { return q.sv; })[0];
  if (withSv) g2 = se.stateValue(g2, withSv.id, 0, 'Ac', opt);
  // moved along the border and deleted (2026-11-14): a made one and a file's own, a made one deleted, a file's macromolecule deleted
  g2 = se.stateMove(g2, 'made1', 0, 0, -0.5, opt);
  g2 = se.state(g2, 'made1', 'gone', 0.5, 0, opt);
  g2 = se.stateDelete(g2, 'made1', 2, opt);
  if (withSv) g2 = se.stateMove(g2, withSv.id, 0, 0.5, 0.25, opt);
  var svIds = withSv ? svOf(s, withSv.id) : [];
  if (svIds.length > 1) g2 = se.stateDelete(g2, withSv.id, 0, { DOMParser: DP, sbgn: s });   // the moved one, not the last: taken out by its id
  var doomed = mac.filter(function (q) { return q.top && q !== mac[0] && q !== withSv; })[0];
  if (doomed) g2 = se.remove(g2, [doomed.id], opt);
  // units of information and multimers (2026-11-14): made1 a multimer with N:3 and two more units, one retyped, one
  // deleted; a file's macromolecule made a multimer with a unit; a file's multimer made single, one of its units deleted
  g2 = se.multimer(g2, 'made1', true, opt);
  g2 = se.unit(g2, 'made1', 'N:3', opt); g2 = se.unit(g2, 'made1', 'ct:gene', opt); g2 = se.unit(g2, 'made1', 'gone unit', opt);
  g2 = se.unitValue(g2, 'made1', 1, 'mt:prot & <x>', opt); g2 = se.unitDelete(g2, 'made1', 2, opt);
  var single = mac.filter(function (q) { return q !== mac[0] && q !== withSv && q !== doomed; })[0];
  if (single) { g2 = se.multimer(g2, single.id, true, opt); g2 = se.unit(g2, single.id, 'N:2', opt); }
  var multi = all.filter(function (q) { return /^(macromolecule|simple chemical|nucleic acid feature) multimer$/.test(q.cls) && q.ui.length && q.top; })[0];
  if (multi) { g2 = se.multimer(g2, multi.id, false, opt); g2 = se.unitDelete(g2, multi.id, 0, { DOMParser: DP, sbgn: s }); }
  // resized (2026-11-14): a made macromolecule with state variables, a file's own with its lines, a file's own simple
  // chemical; the box written, what the glyph carries scaled with it
  var sized = [['made1', r3([right + 100, top - 8, D.w + 24, D.h + 8])]];   // under 1.2 times the height: the converter's map scale (median protein height) stays
  var big = mac.filter(function (q) { return q !== mac[0] && q !== withSv && q !== doomed; })[0];
  if (big) sized.push([big.id, r3([big.box[0] - 4, big.box[1] + 4, big.box[2] + 16, big.box[3] - 8])]);
  if (chem[0]) sized.push([chem[0].id, r3([chem[0].box[0], chem[0].box[1], chem[0].box[2] + 16, chem[0].box[3] + 8])]);
  sized.forEach(function (q) { g2 = se.resize(g2, q[0], q[1], opt); });
  var s2 = se.write(s, g2, opt), p2 = path.join(tmp, i + path.extname(f));
  fs.writeFileSync(p2, s2);
  made.push({ f: f, s: s, g: g, g2: g2, s2: s2, p2: p2, comp: !!comp, mac: mac[0], withSv: withSv, doomed: doomed, svIds: svIds, chem: chem, single: single, multi: multi, sized: sized });
});
var after = conv(made.map(function (m) { return m.p2; }));
made.forEach(function (m, i) {
  ran++;
  var name = path.relative(here, m.f), c2 = after[i], why = [];
  if (!c2) why.push('the converter cannot read the file written');
  else {
    var want = d3(draw(c2));
    if (d3(draw(m.g2)) !== want) why.push('the editor\'s drawing differs from the converter\'s of the file written');
    var re = se.graphml(m.s2, m.g, opt);
    if (d3(draw(re)) !== want) why.push('graphml(s2, base) is drawn differently');
    if (se.write(m.s2, c2, opt) !== m.s2) why.push('write(s2, conv(s2)) is not s2');
  }
  if (m.s2.indexOf('id="made1"') < 0 || m.s2.indexOf('value="P" variable="S12"') < 0 || m.s2.indexOf('text="Made one"') < 0) why.push('made1 not written as made');
  if (m.comp && !/id="made2" compartmentRef="/.test(m.s2)) why.push('made2 not in its compartment');
  if (!/<(\w+:)?glyph class="simple chemical" id="chem1">\s*<(\w+:)?label text="ATP"\/>\s*<(\w+:)?bbox [^>]*\/>\s*<\/(\w+:)?glyph>/.test(m.s2)) why.push('chem1 not written as made');
  if (m.comp && !/class="simple chemical" id="chem2" compartmentRef="/.test(m.s2)) why.push('chem2 not in its compartment');
  if (m.chem[0] && m.s2.indexOf('text="Renamed chemical"') < 0) why.push('the chemical\'s rename not written');
  if (m.chem[1] && m.s2.indexOf('id="' + m.chem[1].id + '"') >= 0) why.push('a deleted simple chemical still in the file');
  if (m.mac && m.s2.indexOf('text="Renamed &amp; &lt;x&gt;"') < 0) why.push('the rename not written');
  if (m.withSv && m.svIds.length < 2 && m.s2.indexOf('value="Ac"') < 0) why.push('the state variable\'s value not written');
  if (m.svIds.length > 1 && (m.s2.indexOf('id="' + m.svIds[0] + '"') >= 0 || m.svIds.slice(1).some(function (x) { return m.s2.indexOf('id="' + x + '"') < 0; }))) why.push('the wrong state variable deleted');
  if (m.s2.indexOf('value="gone"') >= 0) why.push('a deleted state variable written');
  if (m.doomed && m.s2.indexOf('id="' + m.doomed.id + '"') >= 0) why.push('a deleted macromolecule still in the file');
  var cls2 = {}; glyphs(m.s2).forEach(function (q) { cls2[q.id] = q; });
  if (!cls2.made1 || cls2.made1.cls !== 'macromolecule multimer' || cls2.made1.ui.length !== 2 || m.s2.indexOf('text="mt:prot &amp; &lt;x&gt;"') < 0 || m.s2.indexOf('text="N:3"') < 0) why.push('made1 not a multimer with its two units');
  if (m.s2.indexOf('gone unit') >= 0) why.push('a deleted unit of information written');
  if (m.single && (!cls2[m.single.id] || cls2[m.single.id].cls !== 'macromolecule multimer')) why.push('a macromolecule not made a multimer');
  if (m.multi && (!cls2[m.multi.id] || / multimer$/.test(cls2[m.multi.id].cls) || cls2[m.multi.id].ui.indexOf(m.multi.ui[0]) >= 0 || cls2[m.multi.id].ui.length !== m.multi.ui.length - 1)) why.push('a multimer not made single, or the wrong unit deleted');
  var now = new DP().parseFromString(m.s2.replace(/^\ufeff/, ''), 'application/xml'), gl = now.getElementsByTagNameNS('*', 'glyph');
  m.sized.forEach(function (q) {
    var g = Array.prototype.filter.call(gl, function (x) { return x.getAttribute('id') === q[0]; })[0];
    var b = g && Array.prototype.filter.call(g.childNodes, function (c) { return c.localName === 'bbox'; })[0];
    if (!b || r3(['x', 'y', 'w', 'h'].map(function (k) { return parseFloat(b.getAttribute(k)); })).join() !== q[1].join()) why.push(q[0] + ' not resized as asked');
  });
  if (why.length) { bad++; console.log('DIFFERENT ' + name + ': ' + why.join('; ')); }
});
fs.rmSync(tmp, { recursive: true, force: true });
console.log(ran + ' SBGN-ML maps, macromolecules and simple chemicals made, named, with state variables and units of information, resized (' + made.filter(function (m) { return m.single; }).length + ' made multimers, ' +
  made.filter(function (m) { return m.multi; }).length + ' multimers made single): ' + (bad ? bad + ' different' : 'all the same'));
process.exit(bad ? 1 : 0);
