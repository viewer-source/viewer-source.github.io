// A MINERVA project packed into a zip (editor/src/minerva.js: packPlan, packEntries, zip), in Node, against the Forge's
// reference (pathwayforge scripts/minerva_zip.py): each open zip read and packed whole gives the same maps, pictures and
// kept files byte for byte as `minerva_zip.py pack` of the same zip read; then one map alone, two submaps, a submap
// deleted with links to it in mapping.xml and in config.json, the Z-Index reckoned, the refusals, the SVG's pixels.
//   node tests/minerva-pack.js <folder of the zips> <folder of reference packs, ref-<zip name>.zip> <pathwayforge clone>
var fs = require('fs'), path = require('path'), es = require('esbuild'), os = require('os'), cp = require('child_process');
var src = es.buildSync({ entryPoints: [path.join(__dirname, '..', 'editor', 'src', 'minerva.js')], bundle: true, format: 'cjs', write: false }).outputFiles[0].text;
var mod = { exports: {} }; new Function('module', 'exports', src)(mod, mod.exports); var M = mod.exports;
var zips = process.argv[2], refs = process.argv[3], forge = process.argv[4], bad = 0, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mzpack-'));
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
var ab = function (b) { return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
var dec = new TextDecoder();
async function readZip(file) { var p = M.minervaProject(await M.unzip(ab(fs.readFileSync(file)))); return p; }
async function pack(p, maps, missing, kept) {
  maps = maps || p.maps;
  var plan = M.packPlan(maps.map(function (m) { return { path: m.path, text: m.text, title: m.path }; }));
  kept = kept === undefined ? p.kept : kept;
  var pics = {}; plan.map(function (n) { return n.name; }).concat(M.keptGlyphs(kept)).forEach(function (g) { if (p.glyphs[g]) pics[g] = p.glyphs[g]; });
  var e = M.packEntries(maps, pics, kept, missing || []);
  return { bytes: await M.zip(e.entries), e: e, plan: plan };
}
function py(args) { return cp.spawnSync('python3', ['-I', path.join(forge, 'scripts', 'minerva_zip.py')].concat(args), { encoding: 'utf8' }); }
(async function () {
  for (var z of ['AD_UC_comparison', 'HIDmap_v14', 'asthma_map_bg']) {
    var p = await readZip(path.join(zips, z + '.zip')), r = await pack(p), out = path.join(tmp, z + '.zip');
    fs.writeFileSync(out, r.bytes);
    var c = py(['compare', path.join(refs, 'ref-' + z + '.zip'), out]);
    ok(z + ': packed whole, the same files byte for byte as minerva_zip.py pack', c.status === 0 && / only in the first: 0 /.test(c.stdout), c.stdout.trim());
    ok(z + ': no Z-Index written (the order MINERVA had holds)', r.e.z.length === 0, r.e.z.join(', '));
    var back = await readZip(out);   // the zip read again by step 1's reader: the same project
    ok(z + ': read back as the same project', back.maps.map(function (m) { return m.path; }).join('|') === p.maps.map(function (m) { return m.path; }).join('|') && Object.keys(back.glyphs).length === Object.keys(p.glyphs).length);
    var t = py(['read', out, path.join(tmp, 'read-' + z)]);
    ok(z + ': read by Python zipfile (minerva_zip.py read)', t.status === 0, (t.stderr || '').slice(-200));
  }
  // one map alone: a submap of HIDmap at the root, the pictures it names, nothing else
  var h = await readZip(path.join(zips, 'HIDmap_v14.zip')), tim = h.maps.filter(function (m) { return /timing/.test(m.path); })[0];
  var one = await pack(h, [{ path: 'timing.xml', text: tim.text }], [], {}), b1 = await M.unzip(ab(Buffer.from(one.bytes)));
  ok('one map alone: at the root with its pictures only', b1.map(function (e) { return e.name; }).join('|') === 'timing.xml|glyphs/timing.png', b1.map(function (e) { return e.name; }).join(', '));
  // a submap deleted: the reactions of mapping.xml to its complex left out, the rest as it came
  var drop = h.maps.filter(function (m) { return /submaps\/spleen\.xml$/.test(m.path); })[0], keep = h.maps.filter(function (m) { return m !== drop; });
  var del = await pack(h, keep, [drop.path]), mp = dec.decode(del.e.entries.filter(function (e) { return e.name === 'submaps/mapping.xml'; })[0].data), mp0 = dec.decode(h.kept['submaps/mapping.xml']);
  var cxId = (/<species\b[^>]*name="spleen"[^>]*id="([^"]+)"/.exec(mp0) || [])[1];
  var cnt = function (t) { return (t.match(/<reaction\b/g) || []).length; };
  ok('a submap deleted: its links left out of mapping.xml and said', del.e.gone.join() === 'spleen' && cxId && (mp.match(/<reaction\b[\s\S]*?<\/reaction>/g) || []).every(function (x) { return x.indexOf('species="' + cxId + '"') < 0; }) && cnt(mp) < cnt(mp0), cnt(mp0) + ' reactions to ' + cnt(mp));
  var members = []; mp0.replace(/<celldesigner:species\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/celldesigner:species>/g, function (a, id, body) { if (body.indexOf('<celldesigner:complexSpecies>' + cxId + '<') >= 0) members.push(id); });
  ok('a submap deleted: the links from inside its complex left out too', members.length > 0 && (mp.match(/<reaction\b[\s\S]*?<\/reaction>/g) || []).every(function (x) { return members.every(function (s) { return x.indexOf('species="' + s + '"') < 0; }); }), members.length + ' members');
  ok('a submap deleted: mapping.xml otherwise as it came (reactions alone taken out)', mp0.replace(/[ \t]*<reaction\b[\s\S]*?<\/reaction>[ \t]*\r?\n?/g, '') === mp.replace(/[ \t]*<reaction\b[\s\S]*?<\/reaction>[ \t]*\r?\n?/g, ''));
  ok('a submap deleted: not in the zip', del.e.entries.every(function (e) { return e.name !== drop.path; }));
  // config.json (MINERVA 21 on): an entry to a deleted map left out, the others kept
  var cfg = JSON.stringify({ maps: [{ name: 'top', custom_elements: [{ element_id: 'sa1', submap: 'A' }, { element_id: 'sa2', submap: 'B' }] }, { name: 'B', custom_elements: [] }] });
  var pc = M.packEntries([{ path: 'top.xml', text: '<sbml/>' }], {}, { 'config.json': Buffer.from(cfg) }, ['submaps/B.xml']), c2 = JSON.parse(dec.decode(pc.entries[1].data));
  ok('config.json: the entry and the map to a deleted map left out', c2.maps.length === 1 && c2.maps[0].custom_elements.length === 1 && c2.maps[0].custom_elements[0].submap === 'A' && pc.gone.join() === 'B');
  var pc0 = M.packEntries([{ path: 'top.xml', text: '<sbml/>' }], {}, { 'config.json': Buffer.from(cfg) }, []);
  ok('config.json: nothing deleted, byte for byte', Buffer.from(pc0.entries[1].data).toString() === cfg);
  // Z-Index: an outer and an inner compartment with pictures, a background
  var comp = function (id, z, extra) { return '<compartment metaid="' + id + '" id="' + id + '" name="' + id + '"><notes>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head>\n<title/>\n</head>\n<body>Glyph: glyphs/' + id + '.png\n' + (z == null ? '' : 'Z-Index: ' + z + '\n') + (extra || '') + '</body>\n</html>\n</notes>\n</compartment>'; };
  var alias = function (id, b) { return '<celldesigner:compartmentAlias id="ca_' + id + '" compartment="' + id + '">\n<celldesigner:class>SQUARE</celldesigner:class>\n<celldesigner:bounds x="' + b[0] + '" y="' + b[1] + '" w="' + b[2] + '" h="' + b[3] + '"/>\n</celldesigner:compartmentAlias>'; };
  var bg = function (z) { return '<celldesigner:layerSpeciesAlias x="0" y="0">\n<celldesigner:layerNotes>\nGlyph: glyphs/bg.png\n' + (z == null ? '' : 'Z-Index: ' + z + '\n') + '</celldesigner:layerNotes>\n<celldesigner:bounds x="0" y="0" w="1000" h="800"/>\n</celldesigner:layerSpeciesAlias>'; };
  var cdMap = function (zo, zi, zb, zm) {
    return '<?xml version="1.0"?><sbml xmlns="http://www.sbml.org/sbml/level2/version4" xmlns:celldesigner="http://www.sbml.org/2001/ns/celldesigner"><model id="m"><annotation><celldesigner:extension><celldesigner:listOfCompartmentAliases>\n' +
      alias('outer', [10, 10, 900, 700]) + '\n' + alias('mid', [50, 50, 400, 300]) + '\n' + alias('inner', [60, 60, 100, 100]) + '\n</celldesigner:listOfCompartmentAliases><celldesigner:listOfLayers><celldesigner:layer id="1" name="Background images" locked="false" visible="false"><celldesigner:listOfTexts>\n' + bg(zb) +
      '\n</celldesigner:listOfTexts></celldesigner:layer></celldesigner:listOfLayers></celldesigner:extension></annotation><listOfCompartments>\n' + comp('outer', zo) + '\n<compartment metaid="mid" id="mid" name="mid"/>\n' + comp('inner', zi, zm) + '\n</listOfCompartments></model></sbml>';
  };
  var zs = function (t) { var o = {}; ['outer', 'inner'].forEach(function (id) { var m = new RegExp('id="' + id + '"[\\s\\S]*?</compartment>').exec(t); var zz = m && /Z-Index: (-?\d+)/g; var all = []; var x; while (zz && (x = zz.exec(m[0]))) all.push(+x[1]); o[id] = all; }); var l = /layerNotes>[\s\S]*?Z-Index: (-?\d+)/.exec(t); o.bg = l ? +l[1] : null; return o; };
  var r0 = M.reckonZ(cdMap(null, null, -1));
  ok('Z-Index missing: reckoned from what holds what (outer -4, inner -2: mid between them, no picture)', JSON.stringify(zs(r0.text)) === JSON.stringify({ outer: [-4], inner: [-2], bg: -5 }), JSON.stringify(zs(r0.text)));
  ok('Z-Index missing: written after the Glyph line, the rest byte for byte', r0.text.indexOf('Glyph: glyphs/inner.png\nZ-Index: -2\n</body>') > 0 && r0.text.replace(/Z-Index: -?\d+\n/g, '') === cdMap(null, null, -1).replace(/Z-Index: -?\d+\n/g, ''));
  var r1 = M.reckonZ(cdMap(-2, -3, -9));
  ok('Z-Index in the wrong order: rewritten', JSON.stringify(zs(r1.text)) === JSON.stringify({ outer: [-4], inner: [-2], bg: -9 }), JSON.stringify(zs(r1.text)));
  var right = cdMap(-7, -3, -9), r2 = M.reckonZ(right);
  ok('Z-Index in the right order: kept, nothing written', r2.changed === 0 && r2.text === right);
  var r3 = M.reckonZ(cdMap(-7, -3, -1));
  ok('a background over the compartments: one below the lowest', zs(r3.text).bg === -8 && r3.changed === 1, JSON.stringify(zs(r3.text)));
  var r4 = M.reckonZ(cdMap(-2, null, null, 'Z-Index: -9\n'));
  ok('a Z-Index elsewhere in the notes: one line left, after the Glyph line', JSON.stringify(zs(r4.text).inner) === '[-2]', JSON.stringify(zs(r4.text)));
  var esc = cdMap(null, null, null).replace(/<body>Glyph: glyphs\/(outer|inner)\.png\n<\/body>/g, '<body>&lt;p&gt;Glyph: glyphs/$1.png&lt;/p&gt;</body>'), r5 = M.reckonZ(esc);
  ok('Z-Index in escaped notes (&lt;p&gt;Glyph: ...&lt;/p&gt;): written, counted only when written', r5.changed === 2 && /Glyph: glyphs\/inner\.png\nZ-Index: -2&lt;\/p&gt;/.test(r5.text) && /Glyph: glyphs\/outer\.png\nZ-Index: -4&lt;\/p&gt;/.test(r5.text), r5.changed + ' ' + (r5.text.match(/Glyph[^<]*/g) || []).join(' | '));
  var br = cdMap(null, null, null).replace('Glyph: glyphs/inner.png\n', 'Glyph: glyphs/inner.png<br/>Z-Index: 5<br/>'), r6 = M.reckonZ(br);
  ok('Z-Index after <br/>: the old one out, the new one after the Glyph line', /Glyph: glyphs\/inner\.png\nZ-Index: -2<br\/><br\/>/.test(r6.text) && !/Z-Index: 5/.test(r6.text), (r6.text.match(/Glyph: glyphs\/inner[^\n]*\n?[^<]*<[^>]*>[^<]*<?/) || [''])[0]);
  // the plan: pictures with their first box, mixed proportions said; refusals
  var sp = '<?xml version="1.0"?><sbml xmlns:celldesigner="http://www.sbml.org/2001/ns/celldesigner"><model><annotation><celldesigner:extension><celldesigner:listOfSpeciesAliases>\n<celldesigner:speciesAlias id="sa1" species="s1">\n<celldesigner:bounds x="0" y="0" w="80" h="40"/>\n</celldesigner:speciesAlias>\n<celldesigner:speciesAlias id="sa2" species="s1">\n<celldesigner:bounds x="0" y="0" w="40" h="40"/>\n</celldesigner:speciesAlias>\n</celldesigner:listOfSpeciesAliases></celldesigner:extension></annotation><listOfSpecies>\n<species id="s1" name="A"><notes><html><body>Glyph: glyphs/a &amp; b.png\n</body></html></notes></species>\n</listOfSpecies></model></sbml>';
  var pl = M.packPlan([{ path: 'x.xml', text: sp, title: 'x' }]);
  ok('the plan: a species picture with its first box, aliases of other proportions said', pl.length === 1 && pl[0].name === 'glyphs/a & b.png' && pl[0].box.join() === '80,40' && pl[0].mixed);
  var refused = function (what, maps, why) { var m; try { M.packPlan(maps); m = 'planned'; } catch (e) { m = e.message; } ok('refused: ' + what, m.indexOf(why) >= 0, m); };
  refused('a GraphML map', [{ path: 'a.xml', text: '<?xml version="1.0"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns"/>', title: 'Glycolysis' }], 'the map Glycolysis is GraphML: only CellDesigner maps go into a MINERVA zip');
  refused('an SBGN-ML map', [{ path: 'a.xml', text: '<sbgn xmlns="http://sbgn.org/libsbgn/0.3"><map/></sbgn>', title: 'B' }], 'the map B is SBGN-ML');
  refused('two maps of one file name', [{ path: 'submaps/a.xml', text: sp, title: 'one' }, { path: 'submaps/A.xml', text: sp, title: 'two' }], 'two maps would be submaps/A.xml in the zip');
  refused('a picture in a folder of glyphs/', [{ path: 'a.xml', text: sp.replace('glyphs/a', 'glyphs/x/a'), title: 'x' }], 'MINERVA reads images as glyphs/<name>.png');
  // an SVG's pixels: 2 a map unit, at most 8000 on a side, the box's proportions
  ok('an SVG drawn at 2 pixels a map unit', M.svgPixels([300, 100]).join() === '600,200');
  ok('an SVG capped at 8000 px, its proportions kept', M.svgPixels([10000, 2500]).join() === '8000,2000');
  ok('a PNG within 5% of its box\'s proportions goes as it is', M.fitPixels([300, 100], [310, 100]) === null);
  ok('a PNG of other proportions: resampled to the box\'s, no side smaller', M.fitPixels([300, 300], [300, 100]).join() === '900,300' && M.fitPixels([100, 400], [300, 100]).join() === '1200,400');
  ok('a PNG resampled: at most 8000 px a side', M.fitPixels([6000, 6000], [400, 100]).join() === '8000,2000');
  // the zip: one date on every entry, the same bytes twice, UTF-8 names flagged
  var zz = Buffer.from(await M.zip([{ name: 'submaps/AF14 Th0.xml', data: 'a' }, { name: 'glyphs/é.png', data: new Uint8Array([1, 2]) }])), zz2 = Buffer.from(await M.zip([{ name: 'submaps/AF14 Th0.xml', data: 'a' }, { name: 'glyphs/é.png', data: new Uint8Array([1, 2]) }]));
  fs.writeFileSync(path.join(tmp, 'names.zip'), zz);
  var pz = cp.spawnSync('python3', ['-I', '-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print("|".join("%s %s %s %d" % (i.filename, i.date_time[:3], z.read(i.filename), i.flag_bits & 0x800) for i in z.infolist())); z.testzip()', path.join(tmp, 'names.zip')], { encoding: 'utf8' });
  ok('the zip read by Python: names, one date, contents, UTF-8 flag only where needed', pz.stdout.trim() === "submaps/AF14 Th0.xml (2026, 1, 1) b'a' 0|glyphs/é.png (2026, 1, 1) b'\\x01\\x02' 2048", (pz.stdout + pz.stderr).trim());
  ok('the same entries give the same bytes', zz.equals(zz2));
})().catch(function (e) { bad++; console.log('WRONG ' + e.stack); }).then(function () {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
});
