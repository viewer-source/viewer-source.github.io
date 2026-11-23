// Every drawing and written text compared with what the previous release gives on the same maps, so a change that
// alters an output nobody meant to alter is found. Nothing is stored: the earlier code is a checkout of the release
// repository at that commit, named by BASE (the workflow Compare renderers takes the commit of its previous run).
//   BASE=<checkout of an earlier release> node tests/<test>.js
// Without BASE the tests run their own checks only and say that nothing was compared.
// The maps: test-maps/test-set/ (its README: chosen so every element kind, in its context, is in two maps where it
// exists twice, from two origins where it can), unless files are named on the command line.
// A difference is shown with its first differing line; each one is either meant (said with the change) or a bug.
var fs = require('fs'), path = require('path');
var BASE = process.env.BASE ? path.resolve(process.env.BASE) : null;
function firstDiff(a, b) {   // the first line that differs, shortened round the first differing character
  var A = a.split('\n'), B = b.split('\n'), k = 0;
  while (k < A.length && k < B.length && A[k] === B[k]) k++;
  var x = A[k] || '', y = B[k] || '', c = 0;
  while (c < x.length && x[c] === y[c]) c++;
  var cut = function (s) { return (c > 120 ? '...' : '') + s.slice(Math.max(0, c - 120), c + 180); };
  return 'line ' + (k + 1) + '\n    before: ' + cut(x) + '\n    now:    ' + cut(y);
}
function text(v) { return typeof v === 'string' ? v : JSON.stringify(v); }
function open(test) {
  if (BASE && !fs.existsSync(path.join(BASE, 'renderers'))) throw new Error('BASE has no renderers/: ' + BASE);
  var counts = { same: 0, different: 0 }, firsts = [], n = 0;
  return {
    // the earlier release's module at rel (as 'renderers/yrender/yrender.js'), or null when there is no BASE
    base: function (rel) { return BASE ? require(path.join(BASE, rel)) : null; },
    // the default maps: the test set, else the files or folders named
    files: function (argv, keep) {
      var out = [];
      (argv.length ? argv : [path.join(__dirname, '..', 'test-maps', 'test-set')]).forEach(function walk(p) {
        var st; try { st = fs.statSync(p); } catch (e) { return; }
        if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
        else if (keep(p)) out.push(p);
      });
      return out;
    },
    // now and before: the outputs of the new and the earlier code for one case (before is ignored without BASE)
    check: function (key, now, before) {
      n++;
      if (!BASE) return 'not compared';
      var a = text(before), b = text(now);
      if (a === b) { counts.same++; return 'same'; }
      counts.different++;
      console.log('different: ' + key);
      if (firsts.length < 3) firsts.push(key + ': ' + firstDiff(a, b));
      return 'different';
    },
    // the test's last lines; true when nothing differs and there was a case at all
    end: function (what) {
      if (!n) { console.log(what + ': no case at all (no maps found?)'); return false; }
      if (!BASE) { console.log(what + ': ' + n + ' cases, not compared with an earlier release (no BASE)'); return true; }
      console.log(what + ' against the release in ' + path.basename(BASE) + ': ' + counts.same + ' the same, ' + counts.different + ' different');
      firsts.forEach(function (f) { console.log('first difference: ' + f); });
      return counts.different === 0;
    }
  };
}
module.exports = { open: open };
