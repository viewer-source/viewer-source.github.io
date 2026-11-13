// cdrender.py and cd_edit.py against cdrender.js and cd_edit.js on the same CellDesigner maps: the same text byte for
// byte, in every way the viewer uses them: the build's drawing (classes) and its click data, the editor's drawing
// (groups), cd_edit's GraphML, and cd_edit's write-back after moves (nodes, bend points, ports, as the editor makes them).
// Python is the master until the switch (user's yes).
//   node tests/cd-compare.js [python] [CellDesigner files or folders ...]   (default: python3, maps/)
// Needs lxml for that Python and @xmldom/xmldom for Node.
var fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), cd = require(path.join(here, 'renderers/converter/cdrender.js'));
var ed = fs.existsSync(path.join(here, 'renderers/converter/cd_edit.js')) ? require(path.join(here, 'renderers/converter/cd_edit.js')) : null;
var DP = require('@xmldom/xmldom').DOMParser;
var args = process.argv.slice(2), py = args[0] && !/\.xml$|\//.test(args[0]) && !fs.existsSync(args[0]) ? args.shift() : 'python3';
var files = [];
(args.length ? args : [path.join(here, 'maps')]).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.xml$/.test(p)) { var t = fs.readFileSync(p, 'utf8').slice(0, 3000); if (/<sbml[\s>]/.test(t) && t.indexOf('celldesigner') >= 0) files.push(p); }
});
var DRIVER = [
  'import sys, json, io, random',
  'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/converter')) + ']',
  'import cdrender, cd_edit',
  'def err(e): return [None, type(e).__name__]',
  'def moved(g, seed):',
  '    # the GraphML as the editor leaves it after some moves: a few nodes shifted, bend points shifted, a port set to a side',
  '    from lxml import etree',
  '    Y = "{http://www.yworks.com/xml/graphml}"; G = "{http://graphml.graphdrawing.org/xmlns}"',
  '    r = etree.fromstring(g.encode("utf-8")); rnd = random.Random(seed)',
  '    nodes = [n for n in r.iter(G + "node") if not n.get("id").endswith("|proc") and n.find(G + "graph") is None]',
  '    for n in rnd.sample(nodes, min(3, len(nodes))):',
  '        for geo in n.iter(Y + "Geometry"):',
  '            geo.set("x", repr(float(geo.get("x")) + rnd.choice([-37.5, 12.0, 60.25]))); geo.set("y", repr(float(geo.get("y")) + rnd.choice([-20.0, 8.5, 33.0])))',
  '    pts = list(r.iter(Y + "Point"))',
  '    for p in rnd.sample(pts, min(3, len(pts))):',
  '        p.set("x", repr(float(p.get("x")) + 7.0)); p.set("y", repr(float(p.get("y")) - 11.5))',
  '    paths = [e.find(".//" + Y + "Path") for e in r.iter(G + "edge")]',
  '    for p in rnd.sample(paths, min(2, len(paths))):',
  '        p.set("sx", "0.0"); p.set("sy", "-20.0")',
  '    mods = [e.find(".//" + Y + "Path") for e in r.iter(G + "edge") if "|m" in e.get("id")]',
  '    for p in rnd.sample(mods, min(2, len(mods))):   # a modifier end moved round its glyph',
  '        p.set("tx", rnd.choice(["4.5", "-5.25", "0.5"])); p.set("ty", rnd.choice(["-6.0", "3.75", "0.25"])); p.set("spot", str(rnd.randint(2, 7)))',
  '    if seed % 2 and nodes:   # past the left and top edges: the whole map shifted back',
  '        geo = nodes[0].find(".//" + Y + "Geometry"); geo.set("x", "-120.0"); geo.set("y", "-60.0")',
  '    return etree.tostring(r, encoding="unicode")',
  'out = []',
  'for f in json.load(sys.stdin):',
  '    t = open(f, encoding="utf-8").read(); row = {"text": t}',
  '    cdrender.CLASSES = True; cdrender.GROUPS = False',
  '    try: row["classes"] = list(cdrender.render_hits(io.BytesIO(t.encode())))',
  '    except Exception as e: row["classes"] = err(e)',
  '    cdrender.CLASSES = False',
  '    try: row["plain"] = cdrender.render(io.BytesIO(t.encode()))',
  '    except Exception as e: row["plain"] = err(e)',
  '    cdrender.CLASSES = cdrender.GROUPS = True',
  '    try: row["groups"] = cdrender.render(io.BytesIO(t.encode()))',
  '    except Exception as e: row["groups"] = err(e)',
  '    cdrender.CLASSES = cdrender.GROUPS = False',
  '    try: g = cd_edit.graphml(t); row["graphml"] = g',
  '    except Exception as e: row["graphml"] = err(e); g = None',
  '    row["edits"] = []',
  '    if g is not None:',
  '        for seed in (1, 2, 3):',
  '            mg = moved(g, seed)',
  '            try: row["edits"].append([mg, list(cd_edit.draw(t, mg))])',
  '            except Exception as e: row["edits"].append([mg, err(e)])',
  '            cdrender.CLASSES = cdrender.GROUPS = False',
  '    out.append(row)',
  'print(json.dumps(out))'].join('\n');
var n = 0, bad = 0, first = null, tPy = 0, tJs = 0, refused = 0;
function same(label, want, got) {
  n++;
  if (Array.isArray(want) && want[0] === null && Array.isArray(got) && got[0] === null) { refused++; return; }
  if (JSON.stringify(want) === JSON.stringify(got)) return;
  bad++;
  console.log('differs: ' + label);
  if (!first) {
    var a = JSON.stringify(want), b = JSON.stringify(got), k = 0;
    while (k < a.length && a[k] === b[k]) k++;
    first = label + '\n  python: ' + a.slice(Math.max(0, k - 150), k + 150) + '\n  js:     ' + b.slice(Math.max(0, k - 150), k + 150);
  }
}
function js(f) { try { return f(); } catch (e) { var m = /^(\w+Error):/.exec(e.message); return [null, m ? m[1] : e.name]; } }
for (var c0 = 0; c0 < files.length; c0 += 10) {
  var chunk = files.slice(c0, c0 + 10), t0 = Date.now();
  var ref = JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(chunk), maxBuffer: 1 << 30, stdio: ['pipe', 'pipe', 'ignore'] }).toString());
  tPy += Date.now() - t0;
  chunk.forEach(function (f, i) {
    var r = ref[i], t = r.text, name = path.relative(here, f), t1 = Date.now(), o = { DOMParser: DP };
    var hits = js(function () { var h = cd.renderHits(t, Object.assign({ classes: true }, o)); return [h[0], h[1]]; });
    // the click data compared as values (Python's JSON writes 12.0 where JavaScript writes 12)
    same(name + ' (classes)', r.classes, hits);
    same(name + ' (plain)', r.plain, js(function () { return cd.render(t, o); }));
    same(name + ' (groups)', r.groups, js(function () { return cd.render(t, Object.assign({ classes: true, groups: true }, o)); }));
    if (ed) {
      same(name + ' (graphml)', r.graphml, js(function () { return ed.graphml(t, null, o); }));
      r.edits.forEach(function (e, k) { same(name + ' (edit ' + (k + 1) + ')', e[1], js(function () { return ed.draw(t, e[0], o); })); });
    }
    tJs += Date.now() - t1;
  });
}
console.log(files.length + ' maps, ' + n + ' comparisons: ' + (n - bad) + ' the same (' + refused + ' refused by both), ' + bad + ' different; python ' + tPy + ' ms (with its start), js ' + tJs + ' ms' + (ed ? '' : ' (cd_edit.js not there yet: drawings only)'));
if (first) console.log('first difference: ' + first);
process.exit(bad ? 1 : 0);
