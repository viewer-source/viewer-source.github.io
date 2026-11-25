// A MINERVA project zip read and checked (editor/src/minerva.js), in Node, against the Forge's reference reader
// (pathwayforge scripts/minerva_zip.py read): the same maps, the same pictures byte for byte, the same other files kept;
// and the zips refused whole, each with its reason.
//   node tests/minerva-open.js <folder of the zips> <folder of minerva_zip.py read outputs, one per zip>
// The second folder holds <zip name>/ as `python3 -I minerva_zip.py read <zip> <folder>/<zip name>` wrote it.
var fs = require('fs'), path = require('path'), es = require('esbuild'), zlib = require('zlib');
var src = es.buildSync({ entryPoints: [path.join(__dirname, '..', 'editor', 'src', 'minerva.js')], bundle: true, format: 'cjs', write: false }).outputFiles[0].text;
var mod = { exports: {} }; new Function('module', 'exports', src)(mod, mod.exports); var M = mod.exports;
var zips = process.argv[2], refs = process.argv[3], bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
function walk(d, base) { var out = []; fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) { var p = path.join(d, e.name), r = base ? base + '/' + e.name : e.name; if (e.isDirectory()) out = out.concat(walk(p, r)); else out.push(r); }); return out; }
// a small zip made here: entries [name, text or bytes, deflate?]
function zipOf(entries) {
  var parts = [], cd = [], off = 0;
  entries.forEach(function (e) {
    var name = Buffer.from(e[0]), data = Buffer.isBuffer(e[1]) ? e[1] : Buffer.from(e[1]), comp = e[2] ? zlib.deflateRawSync(data) : data;
    var crc = zlib.crc32 ? zlib.crc32(data) : 0, h = Buffer.alloc(30), c = Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(e[2] ? 8 : 0, 8); h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(e[2] ? 8 : 0, 10); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    parts.push(h, name, comp); cd.push(c, name); off += 30 + name.length + comp.length;
  });
  var cdb = Buffer.concat(cd), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cdb.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat(parts.concat([cdb, end]));
}
(async function () {
  for (var z of ['AD_UC_comparison', 'HIDmap_v14', 'asthma_map_bg']) {
    var buf = fs.readFileSync(path.join(zips, z + '.zip')), ref = path.join(refs, z), rep = JSON.parse(fs.readFileSync(path.join(ref, 'report.json')));
    var ents = await M.unzip(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)), p = M.minervaProject(ents);
    var files = walk(ref).filter(function (f) { return f !== 'report.json'; });
    ok(z + ': the top level and the submaps as the reference reads them', p.maps.map(function (m) { return m.path; }).join('|') === rep.top.concat(rep.submaps).join('|'), p.maps.length + ' maps');
    ok(z + ': every map byte for byte', p.maps.every(function (m) { return Buffer.from(m.text).equals(fs.readFileSync(path.join(ref, m.path))); }));
    var used = rep.glyphs.filter(function (g) { return rep.unused_glyphs.indexOf(g) < 0; });
    ok(z + ': the pictures the maps name, byte for byte', Object.keys(p.glyphs).sort().join('|') === used.sort().join('|') && used.every(function (g) { return Buffer.from(p.glyphs[g]).equals(fs.readFileSync(path.join(ref, g))); }), used.length + ' pictures, ' + p.unused + ' left out unused');
    var others = files.filter(function (f) { return !/^glyphs\//.test(f) && rep.top.concat(rep.submaps).indexOf(f) < 0; }).sort();
    ok(z + ': the other files kept as they came', Object.keys(p.kept).sort().join('|') === others.join('|') && others.every(function (f) { return Buffer.from(p.kept[f]).equals(fs.readFileSync(path.join(ref, f))); }), others.join(', '));
  }
})().catch(function (e) { bad++; console.log('WRONG ' + e.stack); }).then(async function () {
  var cd = '<?xml version="1.0"?><sbml xmlns="http://www.sbml.org/sbml/level2/version4" xmlns:celldesigner="http://www.sbml.org/2001/ns/celldesigner"><model id="m"><notes>Glyph: glyphs/a b.png\n</notes></model></sbml>';
  var sb = '<?xml version="1.0"?><sbgn xmlns="http://sbgn.org/libsbgn/0.3"><map/></sbgn>', png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  var refuse = async function (what, ents, why) {
    var z = zipOf(ents), r;
    try { M.minervaProject(await M.unzip(z.buffer.slice(z.byteOffset, z.byteOffset + z.length))); r = 'opened'; } catch (e) { r = e.message; }
    ok('refused: ' + what, r.indexOf(why) >= 0, r);
  };
  var good = zipOf([['top.xml', cd, true], ['glyphs/a b.png', png], ['__MACOSX/._top.xml', 'x'], ['.DS_Store', 'x'], ['config.json', '{}', true]]);
  var g = M.minervaProject(await M.unzip(good.buffer.slice(good.byteOffset, good.byteOffset + good.length)));
  ok('a small project, stored and deflated entries, Mac files left out, a picture name with a space', g.maps.length === 1 && Object.keys(g.glyphs).join() === 'glyphs/a b.png' && Object.keys(g.kept).join() === 'config.json');
  await refuse('no map at the top', [['submaps/a.xml', cd]], 'no map at its top');
  await refuse('two maps at the top', [['a.xml', cd], ['b.xml', cd], ['glyphs/a b.png', png]], '2 maps at its top');
  await refuse('an SBGN-ML submap', [['a.xml', cd], ['glyphs/a b.png', png], ['submaps/AF14 Th0.xml', sb]], 'the map AF14 Th0 is SBGN-ML: only CellDesigner projects open here');
  await refuse('a picture named but missing', [['a.xml', cd]], 'glyphs/a b.png is named in a but missing from the zip');
  await refuse('an SVG named', [['a.xml', cd.replace('a b.png', 'x.svg')], ['glyphs/x.svg', '<svg/>']], 'MINERVA takes PNG pictures only');
  await refuse('a picture in a folder inside glyphs/', [['a.xml', cd.replace('a b.png', 'icons/x.png')], ['glyphs/icons/x.png', png]], 'only pictures directly in glyphs/ are read here');
  var crlf = zipOf([['a.xml', cd.replace('a b.png\n', 'a b.png\r\n')], ['glyphs/a b.png', png]]), pc = M.minervaProject(await M.unzip(crlf.buffer.slice(crlf.byteOffset, crlf.byteOffset + crlf.length)));
  ok('notes with Windows line ends: the picture named, kept', Object.keys(pc.glyphs).join() === 'glyphs/a b.png');
  ok('notes with Windows line ends: a rename follows', M.renameGlyph('Glyph: glyphs/a b.png\r\n', 'glyphs/a b.png', 'glyphs/a b-2.png') === 'Glyph: glyphs/a b-2.png\r\n');
  await refuse('a path outside the zip', [['../a.xml', cd]], 'a path outside the zip');
  await refuse('an empty zip', [], 'no map at its top');
  var r; try { await M.unzip(new Uint8Array(100).buffer); r = 'read'; } catch (e) { r = e.message; }
  ok('refused: a file that is not a zip', r === 'not a zip file', r);
  // pictures of the same name kept already: the same file shared, another numbered and the notes changed
  var p = { maps: [{ path: 'a.xml', text: cd }], glyphs: { 'glyphs/a b.png': new Uint8Array(png) }, kept: {} };
  var same = await M.bytesSha(new Uint8Array(png));
  var rn = await M.settleGlyphs(p, { 'glyphs/a b.png': same });
  ok('a picture kept already, the same file: shared, no rename', !rn.length && p.maps[0].text === cd);
  rn = await M.settleGlyphs(p, { 'glyphs/a b.png': 'other', 'glyphs/a b-2.png': 'other' });
  ok('a picture kept already, another file: numbered, the notes changed', rn.join() === 'glyphs/a b.png,glyphs/a b-3.png' && p.maps[0].text.indexOf('Glyph: glyphs/a b-3.png\n') > 0 && Object.keys(p.glyphs).join() === 'glyphs/a b-3.png', JSON.stringify(rn));
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
});
