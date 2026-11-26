// MINERVA's pictures written by cd_make (step 3 of the pack, notes/minerva-pack-plan.md): a node's picture (a
// compartment, a species, a complex) put on, replaced and taken off in its notes, and a background (a layer text) added,
// moved, replaced and removed; every change leaves the rest of the file byte for byte, a picture put on and taken off
// gives the text back, and cdrender draws what was written. On the demo maps (every CellDesigner map of the data
// repository's maps/) and on the three open zips (their notes as MINERVA wrote them).
//   node tests/minerva-pictures.js <clone of the data repository> [folder of the zips: pathwayforge sources/minerva/]
var fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), here = path.join(__dirname, '..');
var cdr = require(path.join(here, 'renderers/converter/cdrender.js')), mk = require(path.join(here, 'renderers/converter/cd_make.js'));
var DP = require('@xmldom/xmldom').DOMParser;
var data = process.argv[2], zips = process.argv[3], bad = 0, n = 0;
var ok = function (w, v, m) { n++; if (!v) { bad++; console.log('WRONG ' + w + (m ? '  ' + m : '')); } };
function draw(t) { return cdr.render(t, { DOMParser: DP, classes: true, groups: true, glyph: function (p) { return 'data:' + p; } }); }
function diffOnly(a, b) {   // the changed part of b against a: [prefix length, a's middle, b's middle]
  var i = 0; while (i < a.length && a[i] === b[i]) i++;
  var j = 0; while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  return [i, a.slice(i, a.length - j), b.slice(i, b.length - j)];
}
function aliases(t, re) { var m, out = [], r = new RegExp(re, 'g'); while ((m = r.exec(t))) out.push(m[1]); return out; }
function nodeCases(name, t) {
  var comps = aliases(t, '<celldesigner:compartmentAlias id="([^"]+)"'), tops = aliases(t, '<celldesigner:speciesAlias id="([^"]+)"(?![^>]*complexSpeciesAlias=)'),
    cxs = aliases(t, '<celldesigner:complexSpeciesAlias id="([^"]+)"(?![^>]*complexSpeciesAlias=)'), mems = aliases(t, '<celldesigner:speciesAlias id="([^"]+)"[^>]*complexSpeciesAlias=');
  [['compartment', comps[0]], ['species', tops[0]], ['complex', cxs[0]]].forEach(function (c) {
    if (!c[1]) return;
    var w = name + ' ' + c[0] + ' ' + c[1], was = mk.pictureOf(t, c[1]);
    var t1 = mk.picture(t, c[1], 'glyphs/test & one.png');
    ok(w + ': read back', mk.pictureOf(t1, c[1]) === 'glyphs/test & one.png', mk.pictureOf(t1, c[1]));
    ok(w + ': the name escaped in the file', t1.indexOf('Glyph: glyphs/test &amp; one.png') >= 0);
    var d = diffOnly(t, t1);
    ok(w + ': only the notes changed', !/<(?!\/?(notes|html|head|title|body)\b)[a-zA-Z]/.test(d[2].replace(/<html xmlns="[^"]*">/, '<html>')), JSON.stringify(d[2]).slice(0, 200));
    var t2 = mk.picture(t1, c[1], 'glyphs/two.png');
    ok(w + ': replaced', mk.pictureOf(t2, c[1]) === 'glyphs/two.png' && (t2.match(/Glyph:/g) || []).length === (t1.match(/Glyph:/g) || []).length);
    var t3 = mk.picture(t2, c[1], null);
    ok(w + ': taken off, the text as it was', was ? mk.pictureOf(t3, c[1]) === null : t3 === t, was ? '' : JSON.stringify(diffOnly(t, t3)).slice(0, 300));
    if (!was) {
      var s = draw(t1);
      ok(w + ': drawn', s.indexOf('data:glyphs/test &amp; one.png') >= 0 || s.indexOf('data:glyphs/test & one.png') >= 0);
      new DP({ onError: function (l, m) { if (l !== 'warning') { bad++; console.log('WRONG ' + w + ': not well formed: ' + m); } } }).parseFromString(t1, 'application/xml');
    }
  });
  if (mems[0]) { var why = null; try { mk.picture(t, mems[0], 'glyphs/x.png'); } catch (e) { why = e.refused && e.message; } ok(name + ' member: refused', /complex does/.test(why || ''), why); }
  // a background added, moved, replaced, removed
  var b0 = mk.backgrounds(t).length, r = mk.background(t, 'glyphs/bg.png', [0, 0, 400, 300]), tb = r.text;
  var bs = mk.backgrounds(tb);
  ok(name + ' background: added', bs.length === b0 + 1 && bs.some(function (g) { return g.n === r.n && g.name === 'glyphs/bg.png' && g.box.join() === '0,0,400,300'; }), JSON.stringify(bs));
  var sb = draw(tb);
  ok(name + ' background: drawn under everything', sb.indexOf('data:glyphs/bg.png') >= 0 && (sb.indexOf('<g data-n=') < 0 || sb.indexOf('data:glyphs/bg.png') < sb.indexOf('<g data-n=')));
  var tm = mk.backgroundSet(tb, r.n, { box: [10.5, 20, 300, 200] });
  ok(name + ' background: moved and resized', mk.backgrounds(tm).filter(function (g) { return g.n === r.n; })[0].box.join() === '10.5,20,300,200' && /layerSpeciesAlias x="10.5" y="20.0"/.test(tm));
  var tr = mk.backgroundSet(tm, r.n, { name: 'glyphs/bg2.png' });
  ok(name + ' background: replaced', mk.backgrounds(tr).filter(function (g) { return g.n === r.n; })[0].name === 'glyphs/bg2.png');
  var r2 = mk.background(tr, 'glyphs/bg3.png', [0, 0, 50, 50]);
  ok(name + ' background: a second one in the same layer', (r2.text.match(/name="Background pictures"/g) || []).length === 1 && mk.backgrounds(r2.text).length === b0 + 2);
  var tx = mk.backgroundRemove(mk.backgroundRemove(r2.text, r2.n), r.n);
  ok(name + ' background: both removed, the text as it was', tx === t, JSON.stringify(diffOnly(t, tx)).slice(0, 300));
}
var files = fs.readdirSync(path.join(data, 'maps')).filter(function (f) { return /celldesigner\.xml$/.test(f); });
files.forEach(function (f) { nodeCases(f, fs.readFileSync(path.join(data, 'maps', f), 'utf8')); });
// a reader's own layer named Background (empty, or with a list of squares on the same line): never written into or removed
var own = fs.readFileSync(path.join(data, 'maps', files[0]), 'utf8');
[['<celldesigner:layer id="7" name="Background" locked="false" visible="true">\n<celldesigner:listOfTexts/>\n</celldesigner:layer>', 'empty'],
 ['<celldesigner:layer id="7" name="Background" locked="false" visible="true"><celldesigner:listOfSquares/></celldesigner:layer>', 'one line'],
 ['<celldesigner:layer id="7" name="Background" locked="false" visible="true"/>', 'self-closed']].forEach(function (c) {
  var t0 = own.replace(/<celldesigner:listOfLayers\/>|<celldesigner:listOfLayers>\s*<\/celldesigner:listOfLayers>/, '<celldesigner:listOfLayers>\n' + c[0] + '\n</celldesigner:listOfLayers>');
  if (t0 === own) { ok('own layer ' + c[1] + ': test map has a list of layers', false); return; }
  var r = mk.background(t0, 'glyphs/b.png', [0, 0, 9, 9]), back = mk.backgroundRemove(r.text, r.n);
  ok('own layer Background (' + c[1] + '): left as it was, the background in a layer of its own', r.text.indexOf(c[0]) >= 0 && /name="Background pictures"/.test(r.text), r.text.slice(r.text.indexOf('<celldesigner:listOfLayers'), r.text.indexOf('<celldesigner:listOfLayers') + 400));
  ok('own layer Background (' + c[1] + '): background removed, the text as it was', back === t0);
  new DP({ onError: function (l, m) { if (l !== 'warning') { bad++; console.log('WRONG own layer ' + c[1] + ': not well formed: ' + m); } } }).parseFromString(r.text, 'application/xml');
});
// the layer Background pictures as another tool may leave it (self-closed, on one line): a background added well formed
[['<celldesigner:layer id="7" name="Background pictures" locked="false" visible="false"/>', 'self-closed'],
 ['<celldesigner:layer id="7" name="Background pictures" locked="false" visible="false"><celldesigner:listOfSquares/></celldesigner:layer>', 'one line']].forEach(function (c) {
  var t0 = own.replace(/<celldesigner:listOfLayers\/>|<celldesigner:listOfLayers>\s*<\/celldesigner:listOfLayers>/, '<celldesigner:listOfLayers>\n' + c[0] + '\n</celldesigner:listOfLayers>'), errs = [];
  var r = mk.background(t0, 'glyphs/b.png', [0, 0, 9, 9]);
  new DP({ onError: function (l, m) { if (l !== 'warning') errs.push(m); } }).parseFromString(r.text, 'application/xml');
  ok('layer Background pictures (' + c[1] + '): a background added, well formed, read back', !errs.length && mk.backgrounds(r.text).length === 1 && (r.text.match(/name="Background pictures"/g) || []).length === 1, errs.join(' | '));
});
// notes written after the annotation (SBML allows only before, some tools write after): found, never a second notes block
var sa = aliases(own, '<celldesigner:speciesAlias id="([^"]+)"(?![^>]*complexSpeciesAlias=)')[0], sid = /species="([^"]+)"/.exec(new RegExp('<celldesigner:speciesAlias id="' + sa + '"[^>]*>').exec(own)[0])[1];
var late = own.replace(new RegExp('(<species [^>]*id="' + sid + '"[^>]*>)([\\s\\S]*?)(</species>)'), function (m, a, b, c) { var nt = /\n?<notes>[\s\S]*?<\/notes>/.exec(b), body = nt ? b.replace(nt[0], '') : b; return a + body + '<notes>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head>\n<title/>\n</head>\n<body>Glyph: glyphs/late.png\n</body>\n</html>\n</notes>\n' + c; });
ok('notes after the annotation: the picture read', mk.pictureOf(late, sa) === 'glyphs/late.png', mk.pictureOf(late, sa));
var lr = mk.picture(late, sa, 'glyphs/other.png'), seg = new RegExp('<species [^>]*id="' + sid + '"[\\s\\S]*?</species>').exec(lr)[0];
ok('notes after the annotation: replaced in place, one notes block', (seg.match(/<notes>/g) || []).length === 1 && mk.pictureOf(lr, sa) === 'glyphs/other.png');
// a Z-Index of the element's own, before its picture: kept when the picture is taken off
var zs = own.replace(new RegExp('(<species [^>]*id="' + sid + '"[^>]*>)'), '$1\n<notes>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head>\n<title/>\n</head>\n<body>Z-Index: 5\n</body>\n</html>\n</notes>');
var zr = mk.picture(mk.picture(zs, sa, 'glyphs/z.png'), sa, null);
ok('an own Z-Index: kept when the picture is taken off, the text as it was', zr === zs, JSON.stringify(zr.slice(zr.indexOf('Z-Index') - 60, zr.indexOf('Z-Index') + 40)));
// a CRLF file: lines added with the file's line ends
var crlf = fs.readFileSync(path.join(data, 'maps', files[0]), 'utf8').replace(/\r?\n/g, '\r\n');
var c1 = aliases(crlf, '<celldesigner:speciesAlias id="([^"]+)"(?![^>]*complexSpeciesAlias=)')[0], tc = mk.picture(crlf, c1, 'glyphs/c.png');
ok('CRLF: no bare line end added', !/[^\r]\n/.test(tc));
aliases(crlf, '<celldesigner:(?:speciesAlias|complexSpeciesAlias|compartmentAlias) id="([^"]+)"(?![^>]*complexSpeciesAlias=)').forEach(function (a) {   // every node: put on and off gives the CRLF text back
  ok('CRLF ' + a + ': put on and taken off, the text as it was', mk.picture(mk.picture(crlf, a, 'glyphs/c.png'), a, null) === crlf);
});
ok('CRLF: background with the file\'s line ends', !/[^\r]\n/.test(mk.background(crlf, 'glyphs/b.png', [0, 0, 9, 9]).text));
if (zips) {
  var Z = fs.mkdtempSync(path.join(os.tmpdir(), 'minerva-pics-')) + '/';
  ['AD_UC_comparison', 'HIDmap_v14', 'asthma_map_bg'].forEach(function (z) { fs.mkdirSync(Z + z); cp.execFileSync('unzip', ['-q', '-o', path.join(zips, z + '.zip'), '-x', '__MACOSX/*', '-d', Z + z]); });
  // AD/UC: a compartment with MINERVA's three lines; replaced keeps Z-Index, removed takes all three
  var ad = fs.readFileSync(Z + 'AD_UC_comparison/AD_UC_comparison.xml', 'utf8'), ca = null;
  aliases(ad, '<celldesigner:compartmentAlias id="([^"]+)"').some(function (a) { if (mk.pictureOf(ad, a)) { ca = a; return true; } return false; });
  ok('AD/UC: a compartment\'s picture read', !!ca && /^glyphs\//.test(mk.pictureOf(ad, ca)));
  var ar = mk.picture(ad, ca, 'glyphs/new.png'), dd = diffOnly(ad, ar);
  ok('AD/UC: replaced, the name alone changed', /^[^\n]*$/.test(dd[2]) && mk.pictureOf(ar, ca) === 'glyphs/new.png', JSON.stringify(dd));
  var ax = mk.picture(ad, ca, null), dx = diffOnly(ad, ax);
  ok('AD/UC: taken off with its Z-Index and transparency lines', /Glyph:[^\n]*\nZ-Index:[^\n]*\nSemanticZoomLevelTransparency:[^\n]*\n/.test(dx[1]) && !/Glyph|Z-Index|Semantic/.test(dx[2]), JSON.stringify(dx));
  // AsthmaMap: its overview background read, moved, replaced
  var as = fs.readFileSync(Z + 'asthma_map_bg/map.xml', 'utf8'), ab = mk.backgrounds(as);
  ok('AsthmaMap: the overview background read', ab.length === 1 && ab[0].name === 'glyphs/overview.png' && ab[0].box.join() === '0,0,5481,4400', JSON.stringify(ab));
  var am = mk.backgroundSet(as, ab[0].n, { box: [1, 2, 3, 4], name: 'glyphs/o2.png' });
  ok('AsthmaMap: moved and replaced, its own text and Z-Index kept', /Asthma map Cellular Interactions\nGlyph: glyphs\/o2.png\nZ-Index: -1\n/.test(am) && /<celldesigner:bounds x="1.0" y="2.0" w="3.0" h="4.0"\/>/.test(am));
  // HIDmap: every map's backgrounds read
  var hid = fs.readFileSync(Z + 'HIDmap_v14/overview.xml', 'utf8');
  ok('HIDmap overview: its background read', mk.backgrounds(hid).length === 1);
}
console.log(bad ? bad + ' of ' + n + ' WRONG' : 'all ' + n + ' ok');
process.exit(bad ? 1 : 0);
