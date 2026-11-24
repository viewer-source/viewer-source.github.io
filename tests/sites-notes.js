// sbgn_edit.sitesOut and sitesIn (sites as seen, notes/sites-as-drawn.md) on small cases and on files:
// another tool's notes text kept (a line that only mentions PTM, a PTM line with words, paragraphs, notes with no
// body); sitesIn(sitesOut(t)) puts every site back; sitesOut(sitesIn(sitesOut(t))) is sitesOut(t); a byte-order mark kept.
//   node tests/sites-notes.js [SBGN-ML files or folders ...]
var fs = require('fs'), path = require('path'), DP = require('@xmldom/xmldom').DOMParser;
var se = require(path.join(__dirname, '..', 'renderers/converter/sbgn_edit.js')), o = { DOMParser: DP }, bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
var vars = function (t) { return (t.match(/<([\w.-]+:)?state [^>]*variable="[^"]/g) || []).length; };   // a site: a variable not empty
function map(notes) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3">\n  <map id="m" language="process description">\n' +
    '    <glyph id="g1" class="macromolecule">\n' + (notes ? '      <notes>' + notes + '</notes>\n' : '') +
    '      <label text="EGFR"/>\n      <bbox x="0" y="0" w="80" h="40"/>\n' +
    '      <glyph id="g1_sv0" class="state variable">\n        <state value="P" variable="Y1068"/>\n        <bbox x="20" y="32" w="40" h="15"/>\n      </glyph>\n' +
    '    </glyph>\n  </map>\n</sbgn>\n';
}
var XH = '<html xmlns="http://www.w3.org/1999/xhtml">';
[['no notes', ''], ['another tool\'s PTM words', XH + '<body>Known PTM: phosphorylation by AKT</body></html>'],
 ['paragraphs, a PTM line of ours', XH + '<body><p>Hello</p><p>PTM: P@S9</p></body></html>'],
 ['a PTM line with words', XH + '<body>PTM: P@S1 seen in liver</body></html>'],
 ['notes with no body', 'Some text'], ['notes with html and no body', XH + 'Some text</html>']].forEach(function (c) {
  var t = map(c[1]), out = se.sitesOut(t, o), back = se.sitesIn(out, o);
  var keep = c[1].replace(/<[^>]*>/g, ' ').split(/\s+/).filter(function (w) { return w && w.indexOf('@') < 0 && !/^PTM:?$/.test(w); });   // the notes' own words
  ok(c[0] + ': out, no site on the circle', vars(out) === 0);
  ok(c[0] + ': out, the notes\' own text kept', keep.every(function (w) { return out.indexOf(w.trim()) >= 0; }), keep.join(' | '));
  ok(c[0] + ': back, the site on its circle', /variable="Y1068"/.test(back), (back.match(/<state [^>]*>/) || [''])[0]);
  ok(c[0] + ': back, the notes\' own text kept', keep.every(function (w) { return back.indexOf(w.trim()) >= 0; }));
  ok(c[0] + ': out again is out', se.sitesOut(back, o) === out);
  if (/P@S9/.test(c[1])) ok(c[0] + ': a site already in the notes kept', /P@S9/.test(out) && /P@S9/.test(back));
});
ok('a byte-order mark kept', se.sitesOut('﻿' + map(''), o).charCodeAt(0) === 0xFEFF && vars(se.sitesOut('﻿' + map(''), o)) === 0);
var files = [];
(function walk(l) { l.forEach(function (p) { if (fs.statSync(p).isDirectory()) walk(fs.readdirSync(p).sort().map(function (f) { return path.join(p, f); })); else if (/\.(sbgn|nwt)$/.test(p)) files.push(p); }); })(process.argv.slice(2));
var n = 0, sites = 0;
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8'), k = vars(t);
  if (!k) return;
  n++; sites += k;
  var out = se.sitesOut(t, o), back = se.sitesIn(out, o);
  if (vars(out) || vars(back) !== k || se.sitesOut(back, o) !== out) { bad++; console.log('WRONG ' + path.basename(f) + ': ' + k + ' sites, out ' + vars(out) + ', back ' + vars(back)); }
});
if (files.length) console.log((n ? 'ok    ' : '') + n + ' files with ' + sites + ' sites: out and back');
console.log(bad ? bad + ' wrong' : 'all ok');
process.exit(bad ? 1 : 0);
