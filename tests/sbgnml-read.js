// renderers/converter/sbgnml_read.js against its master, the converter's sbgnml.read and graphml.write (the copy in
// renderers/converter/mapconv run by Python, as the site's build runs it): every SBGN-ML file (.sbgn, .nwt) under the
// folders given, read by both, the GraphML compared byte for byte; a file the converter refuses must be refused by the
// copy too. A difference means the converter changed how it reads SBGN-ML: copy the change into sbgnml_read.js (and
// its VERSION), or, for a fix found here, make it in the converter first.
//   node tests/sbgnml-read.js <folder or file> ... [--python python3] [--master <converter's repository>] [--show]
// --master: the converter's own mapconv (the master) in place of the site's copy; --show: where the first line differs
var fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), sr = require(path.join(here, 'renderers/converter/sbgnml_read.js'));
var DP = require('@xmldom/xmldom').DOMParser;
var args = process.argv.slice(2), py = 'python3', show = false, roots = [], pkg = path.join(here, 'renderers/converter');
for (var i = 0; i < args.length; i++) { if (args[i] === '--python') py = args[++i]; else if (args[i] === '--master') pkg = args[++i]; else if (args[i] === '--show') show = true; else roots.push(args[i]); }
if (!roots.length) { console.log('usage: node tests/sbgnml-read.js <folder or file> ...'); process.exit(2); }
var files = [];
(function walk(list) { list.forEach(function (p) { var s = fs.statSync(p); if (s.isDirectory()) walk(fs.readdirSync(p).sort().map(function (f) { return path.join(p, f); })); else if (/\.(sbgn|nwt)$/i.test(p)) files.push(p); }); })(roots);
var driver = [
  'import sys, json, contextlib, io',
  'sys.path.insert(0, sys.argv[1])',
  'from mapconv import graphml as w, sbgnml as r, report',
  'for f in sys.stdin.read().split("\\n"):',
  '    if not f: continue',
  '    try:',
  '        with report.collect(), contextlib.redirect_stdout(io.StringIO()):',
  '            t = w.write(r.read(f))',
  '        print(json.dumps({"f": f, "t": t}))',
  '    except (Exception, SystemExit) as e:',
  '        print(json.dumps({"f": f, "err": type(e).__name__ + ": " + str(e).split("\\n")[0]}))',
].join('\n');
var res = cp.spawnSync(py, ['-c', driver, pkg], { input: files.join('\n'), maxBuffer: 1 << 30, encoding: 'utf8' });
if (res.status) { console.log(res.stderr); process.exit(2); }
var want = {};
res.stdout.split('\n').filter(Boolean).forEach(function (l) { var o = JSON.parse(l); want[o.f] = o; });
var bad = 0, same = 0, refused = 0, t0 = Date.now();
files.forEach(function (f) {
  var w = want[f], got, err = null;
  try { got = sr.graphml(fs.readFileSync(f, 'utf8'), { DOMParser: DP }).text; } catch (e) { err = e.message; }
  var name = path.relative(process.cwd(), f);
  if (w.err) {
    if (err) { refused++; return; }
    bad++; console.log('WRONG ' + name + ': the converter refuses it (' + w.err + '), the copy reads it'); return;
  }
  if (err) { bad++; console.log('WRONG ' + name + ': the copy fails: ' + err); return; }
  if (got === w.t) { same++; return; }
  bad++;
  var a = w.t.split('\n'), b = got.split('\n'), k = 0;
  while (k < a.length && a[k] === b[k]) k++;
  console.log('WRONG ' + name + ': differs from line ' + (k + 1) + ' of ' + a.length);
  if (show) { var x = a[k] || '', y = b[k] || '', j = 0; while (j < x.length && x[j] === y[j]) j++; console.log('  converter: ...' + x.slice(Math.max(0, j - 60), j + 120) + '\n  copy:      ...' + y.slice(Math.max(0, j - 60), j + 120)); }
});
console.log(files.length + ' files: ' + same + ' the same, ' + refused + ' refused by both, ' + bad + ' wrong (' + (Date.now() - t0) + ' ms in the copy)');
process.exit(bad ? 1 : 0);
