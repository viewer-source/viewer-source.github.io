// The reference set: what the JavaScript renderers and writers gave on the demo and test maps, kept as files, so a
// change in any drawing or written text is found and can be read. It replaced the comparisons with the Python twins
// the renderers once had (byte for byte the same as the JavaScript when the set was made).
// The files are in the site's data repository, `reference/<test>/<case>.txt`, linked or copied beside maps/ as
// `reference/` (the workflow Compare renderers copies it with the maps). Each file starts with one line, the hash of
// what was given (the map's text and the case), then what came out. Kinds of result in a test's last line:
//   same        the output as kept
//   different   the same input gave another output: a failure, the first differing line printed
//   changed map the map was saved since its reference was made (edited in the viewer): not checked, not a failure
//   new         no reference yet (a new map or case): not checked, not a failure
// Writing a new set is a commit of its own in the data repository, with its reason in the message:
//   REF=write node tests/<test>.js    writes every case (after a change whose new drawings were read and are right)
//   REF=new node tests/<test>.js      writes only the new and changed-map cases, never a different one
// An output larger than BIG is kept as its hash only (the large test map), so a difference there is said, not shown.
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var ROOT = path.join(__dirname, '..', 'reference'), BIG = 4e6, MODE = process.env.REF || '';
function hash(s) { return crypto.createHash('sha1').update(s).digest('hex'); }
function text(v) { return typeof v === 'string' ? v : JSON.stringify(v, null, 0); }
function diff(a, b) {   // b as the lines that differ from a (Myers' shortest edit): "@@ <line of a> -<lines taken out>" then the lines put in
  var A = a.split('\n'), B = b.split('\n'), lo = 0, hiA = A.length, hiB = B.length;
  while (lo < hiA && lo < hiB && A[lo] === B[lo]) lo++;
  while (hiA > lo && hiB > lo && A[hiA - 1] === B[hiB - 1]) { hiA--; hiB--; }
  var N = hiA - lo, M = hiB - lo, MAX = N + M, V = { 1: 0 }, trace = [], D, k, x, y, done;
  for (D = 0, done = false; D <= MAX && !done; D++) {
    if (D > 2000) return null;   // too different: kept whole
    trace.push(Object.assign({}, V));
    for (k = -D; k <= D; k += 2) {
      x = k === -D || k !== D && V[k - 1] < V[k + 1] ? V[k + 1] : V[k - 1] + 1; y = x - k;
      while (x < N && y < M && A[lo + x] === B[lo + y]) { x++; y++; }
      V[k] = x;
      if (x >= N && y >= M) { done = true; break; }
    }
  }
  var ops = [];   // walked back: [i in A, taken out, put in]
  x = N; y = M;
  for (var d = trace.length - 1; d > 0 && (x > 0 || y > 0); d--) {
    var Vd = trace[d]; k = x - y;
    var pk = k === -d || k !== d && Vd[k - 1] < Vd[k + 1] ? k + 1 : k - 1, px = Vd[pk], py = px - pk;
    while (x > px && y > py) { x--; y--; }
    if (px === x) ops.push([px, 0, [B[lo + py]]]); else ops.push([px, 1, []]);
    x = px; y = py;
  }
  ops.reverse();
  var hunks = [];
  ops.forEach(function (o) {   // neighbouring edits joined into one hunk
    var h = hunks[hunks.length - 1];
    if (h && h[0] + h[1] === o[0]) { h[1] += o[1]; h[2] = h[2].concat(o[2]); } else hunks.push([o[0], o[1], o[2]]);
  });
  return hunks.map(function (h) { return '@@ ' + (lo + h[0] + 1) + ' -' + h[1] + (h[2].length ? '\n' + h[2].join('\n') : ''); }).join('\n');
}
function stored(out, bases) {   // what is kept: each part whole, or as its difference from its base (the text it was made from)
  if (!Array.isArray(out)) out = [out];
  return out.map(function (o, i) {
    o = text(o); var b = bases && bases[i];
    var d = typeof b === 'string' ? diff(b, o) : null;
    return d === null ? '=== part ' + (i + 1) + ', whole\n' + o : '=== part ' + (i + 1) + ', as changed from its base\n' + d;
  }).join('\n');
}
function firstDiff(a, b) {   // the first line that differs, with its number, shortened round the first differing character
  var A = a.split('\n'), B = b.split('\n'), k = 0;
  while (k < A.length && k < B.length && A[k] === B[k]) k++;
  var x = A[k] || '', y = B[k] || '', c = 0;
  while (c < x.length && x[c] === y[c]) c++;
  var cut = function (s) { return (c > 120 ? '...' : '') + s.slice(Math.max(0, c - 120), c + 180); };
  return 'line ' + (k + 1) + '\n    kept: ' + cut(x) + '\n    now:  ' + cut(y);
}
function open(test) {
  if (MODE && MODE !== 'write' && MODE !== 'new') throw new Error('REF is write, new or unset, not ' + MODE);
  if (!fs.existsSync(ROOT)) throw new Error('no reference/ beside maps/ (the data repository\'s reference folder)');
  var dir = path.join(ROOT, test), counts = { same: 0, different: 0, 'changed map': 0, new: 0, written: 0, replaced: 0 }, firsts = [];
  var seen = new Set();
  return {
    // key: the case's name (a map's path and the way, unique in the test); given: everything the output depends on
    // besides the code (the map's text, the case's parameters); out: a string, a JSON value or a list of them (its
    // parts); bases: for each part, the text it was made from (the map before an edit), so only what changed is kept
    check: function (key, given, out, bases) {
      if (seen.has(key)) throw new Error('two cases named ' + key);
      seen.add(key);
      var file = path.join(dir, key.replace(/[^\w.-]+/g, '_') + '.txt'), h = hash(text(given)), o = stored(out, bases);
      var body = o.length > BIG ? 'sha1 ' + hash(o) : o, kept = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      var nl = kept === null ? -1 : kept.indexOf('\n'), kh = nl < 0 ? null : kept.slice(0, nl), kb = nl < 0 ? null : kept.slice(nl + 1);
      var kind = kept === null ? 'new' : kh !== 'input ' + h ? 'changed map' : kb === body ? 'same' : 'different';
      if (MODE === 'write' && kind !== 'same' || MODE === 'new' && (kind === 'new' || kind === 'changed map')) {
        fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, 'input ' + h + '\n' + body); counts.written++;
        if (kind === 'different') { counts.replaced++; return 'written'; }   // REF=write: the new output is the reference now, not a failure
      }
      counts[kind]++;
      if (kind === 'different') {
        console.log('different: ' + key);
        if (firsts.length < 3) firsts.push(key + ': ' + (/^sha1 /.test(body) ? 'a large output, kept as its hash' : firstDiff(kb, body)));
      } else if (kind !== 'same' && process.env.VERBOSE) console.log(kind + ': ' + key);
      return kind;
    },
    // the test's last lines; true when nothing differs
    end: function (what) {
      var stale = counts['changed map'] + counts.new;
      console.log(what + ' against the reference set: ' + counts.same + ' the same, ' + counts.different + ' different' +
        (stale ? ', ' + counts['changed map'] + ' maps changed since their reference and ' + counts.new + ' new, not checked (REF=new writes them)' : '') +
        (counts.replaced ? ', ' + counts.replaced + ' different and replaced (REF=write)' : '') +
        (counts.written ? '; ' + counts.written + ' written' + (MODE === 'write' ? ' (REF=write)' : ' (REF=new)') : ''));
      firsts.forEach(function (f) { console.log('first difference: ' + f); });
      return counts.different === 0;
    }
  };
}
module.exports = { open: open, hash: hash, diff: diff };
