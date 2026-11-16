// cd_make's complex membership (join, leave, joinable) on every CellDesigner map of the demo, read back by the converter
// (renderers/converter/mapconv, Python) and drawn by cdrender:
//   1. the first six members of each map with no line and its species drawn once: taken out (leave, into its complex's compartment), the
//      converter reads it with no complex; put back (join), it reads it in that complex again, its annotations kept;
//   2. a protein made beside the map and joined to a complex, then taken out: the text the original byte for byte;
//      a complex made and put into another complex (a complex in a complex);
//   3. joinable refuses a species with lines ('lines'), a complex put into itself ('inside') and a member ('member');
//   4. cdrender draws every text written with no error.
// node tests/cd-join.js [python3]
var fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), mk = require(path.join(here, 'renderers/converter/cd_make.js')), cdr = require(path.join(here, 'renderers/converter/cdrender.js'));
var DP = require('@xmldom/xmldom').DOMParser, py = process.argv[2] || 'python3', bad = 0;
var DRIVER = [
  'import sys, json, contextlib, io, tempfile, os',
  'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']',
  'from mapconv import celldesigner, report',
  'out = []',
  'for t in json.load(sys.stdin):',
  '    fd, f = tempfile.mkstemp(suffix=".xml"); os.write(fd, t.encode("utf-8")); os.close(fd)',
  '    try:',
  '        with report.collect(), contextlib.redirect_stdout(io.StringIO()): m = celldesigner.read(f)',
  '        ns = m.nodes.values() if isinstance(m.nodes, dict) else m.nodes',
  '        out.append({n.id: [n.parent, sorted((n.data or {}).items())] for n in ns})',
  '    except Exception as e: out.append(str(e))',
  '    os.remove(f)',
  'json.dump(out, sys.stdout)'].join('\n');
function read(texts) { return JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(texts), maxBuffer: 1 << 30 }).toString()); }
function wrong(what) { bad++; console.log('WRONG ' + what); }
function draws(t, what) { try { cdr.render(t, { DOMParser: DP }); } catch (e) { wrong(what + ': not drawn (' + e.message + ')'); } }
var files = fs.readdirSync(path.join(here, 'maps')).filter(function (f) { return /\.xml$/.test(f); }).sort().map(function (f) { return path.join(here, 'maps', f); });
var jobs = [];   // [file, label, text, alias, complex alias or null]
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8'), name = path.basename(f), re = /<celldesigner:(?:speciesAlias|complexSpeciesAlias) id="([^"]+)"[^>]*\scomplexSpeciesAlias="([^"]+)"/g, m;
  if (t.indexOf('<celldesigner:extension>') < 0) return;
  var seen = 0;
  while ((m = re.exec(t)) && seen < 6) {   // 1: each member out and back in (the first six with no line on each map)
    var a = m[1], cx = m[2], I = mk.aliasInfo(t, cx), ca = (new RegExp('id="' + cx + '"[^>]*\\scompartmentAlias="([^"]+)"').exec(t) || [])[1] || null;
    var out = mk.leave(t, a, ca), why = mk.joinable(out, a, cx);
    if (why === 'lines' || why === 'copies') continue;   // a member with lines (other tools' files): not taken in again
    if (why) { wrong(name + ' ' + a + ': not joinable again (' + why + ')'); continue; }
    if (mk.joinable(t, a, cx) !== 'member') wrong(name + ' ' + a + ': a member not refused');
    var back = mk.join(out, a, cx); seen++;
    jobs.push([name, a, t, a, cx, I], [name, a + ' out', out, a, ca], [name, a + ' back', back, a, cx]);
    draws(out, name + ' ' + a + ' out'); draws(back, name + ' ' + a + ' back');
  }
  // 2: a protein made beside the map joins a complex and leaves it again; a complex into another
  var cxs = []; re = /<celldesigner:complexSpeciesAlias id="([^"]+)"/g;
  while ((m = re.exec(t))) cxs.push(m[1]);
  if (!cxs.length) return;
  var W = +/sizeX="([\d.]+)"/.exec(t)[1], p = mk.species(t, { cls: 'PROTEIN', name: 'joined', box: [W + 100, 100] }), t1 = p.text;
  var j = mk.join(t1, p.alias, cxs[0]), l = mk.leave(j, p.alias, mk.aliasInfo(j, cxs[0]) && (new RegExp('id="' + cxs[0] + '"[^>]*\\scompartmentAlias="([^"]+)"').exec(j) || [])[1] || null);
  if (l !== t1 && !/compartmentAlias/.test(new RegExp('<celldesigner:complexSpeciesAlias id="' + cxs[0] + '"[^>]*>').exec(t)[0])) wrong(name + ': a protein joined and taken out again is not the text before');
  jobs.push([name, 'new protein in', j, p.alias, cxs[0]]);
  var c2 = mk.species(t, { cls: 'COMPLEX', name: 'outer', box: [W + 300, 100, 400, 400] }), c3 = mk.species(c2.text, { cls: 'COMPLEX', name: 'inner', box: [W + 350, 150] });
  var jj = mk.join(c3.text, c3.alias, c2.alias);
  if (mk.joinable(jj, c2.alias, c3.alias) !== 'inside') wrong(name + ': a complex into its own member not refused');
  jobs.push([name, 'complex in complex', jj, c3.alias, c2.alias]);
  draws(j, name + ' new protein in'); draws(jj, name + ' complex in complex');
  // 3: a species with lines
  var withLine = /<celldesigner:baseReactant species="[^"]+" alias="([^"]+)"/.exec(t);
  var other = withLine && cxs.filter(function (c) { return c !== withLine[1] && mk.joinable(t, withLine[1], c) !== 'inside'; })[0];
  if (other && mk.aliasInfo(t, withLine[1]).complex == null && !/^(PHENOTYPE|DEGRADED)$/.test(mk.aliasInfo(t, withLine[1]).cls) && mk.joinable(t, withLine[1], other) !== 'lines') wrong(name + ': a species with lines not refused');
});
var R = [], first = {};
for (var k0 = 0; k0 < jobs.length; k0 += 12) R = R.concat(read(jobs.slice(k0, k0 + 12).map(function (q) { return q[2]; })));   // a few at a time: the large maps
jobs.forEach(function (q, k) {
  var r = R[k], what = q[0] + ' ' + q[1];
  if (typeof r === 'string') return wrong(what + ': the converter cannot read it (' + r + ')');
  if (!r[q[3]]) return wrong(what + ': ' + q[3] + ' not read');
  if (r[q[3]][0] !== q[4]) wrong(what + ': read in ' + r[q[3]][0] + ', expected ' + q[4]);
  var key = q[0] + ' ' + q[3];
  if (first[key] == null) first[key] = JSON.stringify(r[q[3]][1]);
  else if (JSON.stringify(r[q[3]][1]) !== first[key]) wrong(what + ': its annotations changed');
});
console.log(jobs.length + ' texts read back' + (bad ? ', ' + bad + ' wrong' : ', all as expected'));
process.exit(bad ? 1 : 0);
