// tidy.py (with complex_pack.py and snap_grid.py) and layout.js on the same maps and the same cases: the text and the
// count of changes must be the same, byte for byte. Python is the master until the switch (user's yes).
//   node tests/layout-compare.js [python] [GraphML or CellDesigner files or folders ...]   (default: python3, maps/)
// Cases per map (chosen by the Python side): Snap map to grid, Pack all, Pack the first complex, the fit after a node
// moved out of its compartment, a compartment resized larger and smaller; a CellDesigner map through cd_edit's GraphML
// with its ports kept (Snap, Pack). Needs lxml for that Python and @xmldom/xmldom for Node.
var fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), lay = require(path.join(here, 'renderers/layout/layout.js'));
var DP = require('@xmldom/xmldom').DOMParser;
var args = process.argv.slice(2), py = args[0] && !/\.(graphml|xml)$|\//.test(args[0]) && !fs.existsSync(args[0]) ? args.shift() : 'python3';
var files = [];
(args.length ? args : [path.join(here, 'maps')]).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.graphml$/.test(p) || (/\.xml$/.test(p) && /<sbml[\s>]/.test(fs.readFileSync(p, 'utf8').slice(0, 3000)))) files.push(p);
});
var DRIVER = [
  'import sys, json, copy',
  'sys.path[:0] = [' + JSON.stringify(path.join(here, 'renderers/layout')) + ', ' + JSON.stringify(path.join(here, 'renderers/converter')) + ']',
  'from lxml import etree',
  'import tidy, complex_pack as cp',
  'G = cp.G',
  'def cases(text):',
  '    root = etree.fromstring(text.encode("utf-8"))',
  '    out = [("grid", []), ("pack", [])]',
  '    cx = [n.get("id") for n in root.iter(G + "node") if cp.is_complex(n)]',
  '    if cx: out.append(("pack", [cx[0]]))',
  '    comps = [n for n in root.iter(G + "node") if tidy.is_compartment(n) and cp.members(n)]',
  '    for c in comps[:2]:',
  '        x, y, w, h = cp.box(c)',
  '        out.append(("fit", {"resize": [c.get("id"), x - 30, y - 30, w + 60, h + 60]}))',
  '        out.append(("fit", {"resize": [c.get("id"), x + 5, y + 5, 10, 10]}))',
  '    return out',
  'def moved(text):',
  '    # a node in a compartment moved 200 to the right and 120 down, as a drag would leave the text',
  '    root = etree.fromstring(text.encode("utf-8"))',
  '    for n in root.iter(G + "node"):',
  '        up = n.getparent().getparent()',
  '        if up.tag == G + "node" and tidy.is_compartment(up) and n.get("yfiles.foldertype") != "group":',
  '            cp.shift(n, 200.0, 120.0)',
  '            return etree.tostring(root, encoding="unicode"), n.get("id")',
  '    return None, None',
  'out = []',
  'for f in json.load(sys.stdin):',
  '    text = open(f, encoding="utf-8").read(); keep = False',
  '    if f.endswith(".xml"):',
  '        import cd_edit',
  '        try: text = cd_edit.graphml(text); keep = True',
  '        except Exception: out.append([]); continue   # not a CellDesigner map the editor can open',
  '    cs = cases(text)',
  '    runs = []',
  '    for what, ids in cs:',
  '        try: r = tidy.tidy(text, what, ids, keep)',
  '        except Exception as e: r = [None, type(e).__name__]',
  '        runs.append([text, what, ids, keep, r])',
  '    if not keep:',
  '        mt, mid = moved(text)',
  '        if mt:',
  '            try: r = tidy.tidy(mt, "fit", {"moved": [mid]}, False)',
  '            except Exception as e: r = [None, type(e).__name__]',
  '            runs.append([mt, "fit", {"moved": [mid]}, False, r])',
  '    out.append(runs)',
  'print(json.dumps(out))'].join('\n');
var tPy = 0, tJs = 0, n = 0, bad = 0, first = null, moving = 0;
for (var c0 = 0; c0 < files.length; c0 += 20) {   // in chunks: every run carries the map's whole text
  var chunk = files.slice(c0, c0 + 20), t0 = Date.now();
  var ref = JSON.parse(cp.execFileSync(py, ['-c', DRIVER], { input: JSON.stringify(chunk), maxBuffer: 1 << 30 }).toString());
  tPy += Date.now() - t0;
  chunk.forEach(compare);
}
function compare(f, i) {
  ref[i].forEach(function (run) {
    n++;
    var text = run[0], want = run[4], got, t1 = Date.now();
    try { got = lay.tidy(text, run[1], run[2], run[3], { DOMParser: DP }); }
    catch (e) { var nm = /^(\w+Error):/.exec(e.message); got = [null, nm ? nm[1] : e.name]; }
    tJs += Date.now() - t1;
    if (want[1] > 0) moving++;
    if (want[0] === null && got[0] === null) return;
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      bad++;
      var label = path.relative(here, f) + ' ' + run[1] + ' ' + JSON.stringify(run[2]).slice(0, 80);
      console.log('differs: ' + label + ' (changes: python ' + want[1] + ', js ' + got[1] + ')');
      if (!first && want[0] && got[0]) {
        var a = want[0].split('\n'), b = got[0].split('\n'), k = 0;
        while (k < a.length && a[k] === b[k]) k++;
        first = label + '\n  python: ' + (a[k] || '').trim().slice(0, 300) + '\n  js:     ' + (b[k] || '').trim().slice(0, 300);
      } else if (!first) first = label + ': python ' + JSON.stringify(want[1]) + ', js ' + JSON.stringify(got[1]);
    }
  });
}
console.log(files.length + ' maps, ' + n + ' runs (' + moving + ' changing the map): ' + (n - bad) + ' the same, ' + bad + ' different; python ' + tPy + ' ms (with its start), js ' + tJs + ' ms');
if (first) console.log('first difference: ' + first);
process.exit(bad ? 1 : 0);
