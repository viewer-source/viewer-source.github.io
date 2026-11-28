// Download as MINERVA zip (step 4 of the pack, notes/minerva-pack-plan.md), live, as a person outside would, with no
// token (this browser):
//   1. Two open zips opened by Add map from file: the first map of each group marked top level in grey, no other map, no
//      group of the demo's.
//   2. The group's heading, Download as MINERVA zip: the zip has the same files byte for byte as minerva_zip.py pack of
//      the zip read (pathwayforge, the reference); nothing said.
//   3. Set as top level on a submap: first in the group, the mark with it; undone by Cmd+Z, the mark back.
//   4. One map, Download as MINERVA zip: that map at the root with only its pictures; the project's other files said
//      left out (AD/UC's mapping.xml).
//   5. Two maps selected, Download 2 maps as MINERVA zip: the first at the root, the second in submaps/.
//   6. A CellDesigner map whose compartment names a picture kept as SVG in this browser: packed with a PNG made at 2
//      pixels a map unit of the compartment's box (stretched to it), its smallest text (6 units) measured in the PNG;
//      the compartment's Z-Index written in the zip and said; the map in the list unchanged.
//   7. A GraphML map selected with it: refused, nothing downloaded, the reason naming the map.
//   node tests/minerva-pack-live.js <folder of the zips> <folder of reference packs, ref-<zip>.zip> <pathwayforge clone> [base address] [--local]
// --local: the editor and the viewer of the working tree routed into the live page (build the editor first).
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
var zips = process.argv[2], refs = process.argv[3], forge = process.argv[4], base = process.argv[5] && process.argv[5][0] !== '-' ? process.argv[5] : 'https://viewer-source.github.io/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..'), bad = 0, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mzlive-'));
var t0 = Date.now(), ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '') + '  (' + Math.round((Date.now() - t0) / 1000) + ' s)'); };
function viewerHunks() {
  var d = cp.execFileSync('git', ['diff', '-U2', process.env.REV || 'HEAD', '--', '_includes/atlas-app.html'], { cwd: here, maxBuffer: 1 << 26 }).toString();
  return d.split(/\n(?=@@ )/).slice(1).map(function (h) {
    var o = [], n = [];
    h.split('\n').slice(1).forEach(function (l) { if (l[0] === ' ') { o.push(l.slice(1)); n.push(l.slice(1)); } else if (l[0] === '-') o.push(l.slice(1)); else if (l[0] === '+') n.push(l.slice(1)); });
    return [o.join('\n'), n.join('\n')];
  });
}
function py(args) { return cp.spawnSync('python3', ['-I', path.join(forge, 'scripts', 'minerva_zip.py')].concat(args), { encoding: 'utf8' }); }
function names(file) { return cp.spawnSync('python3', ['-I', '-c', 'import sys,zipfile; print("|".join(zipfile.ZipFile(sys.argv[1]).namelist()))', file], { encoding: 'utf8' }).stdout.trim().split('|'); }
function member(file, n) { return cp.spawnSync('python3', ['-I', '-c', 'import sys,zipfile; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))', file, n], { maxBuffer: 1 << 28 }).stdout; }
var CD = '<?xml version="1.0" encoding="UTF-8"?>\n<sbml xmlns="http://www.sbml.org/sbml/level2/version4" xmlns:celldesigner="http://www.sbml.org/2001/ns/celldesigner" level="2" version="4">\n<model metaid="untitled" id="untitled">\n<annotation>\n<celldesigner:extension>\n<celldesigner:modelVersion>4.0</celldesigner:modelVersion>\n<celldesigner:modelDisplay sizeX="600" sizeY="400"/>\n' +
  '<celldesigner:listOfCompartmentAliases>\n<celldesigner:compartmentAlias id="ca1" compartment="c1">\n<celldesigner:class>SQUARE</celldesigner:class>\n<celldesigner:bounds x="100.0" y="100.0" w="300.0" h="100.0"/>\n<celldesigner:namePoint x="110.0" y="180.0"/>\n<celldesigner:doubleLine thickness="12.0" outerWidth="2.0" innerWidth="1.0"/>\n<celldesigner:paint color="ffcccc00" scheme="Color"/>\n<celldesigner:info state="empty" angle="-1.5707963267948966"/>\n</celldesigner:compartmentAlias>\n</celldesigner:listOfCompartmentAliases>\n' +
  '<celldesigner:listOfComplexSpeciesAliases/>\n<celldesigner:listOfSpeciesAliases/>\n<celldesigner:listOfGroups/>\n<celldesigner:listOfProteins/>\n<celldesigner:listOfGenes/>\n<celldesigner:listOfRNAs/>\n<celldesigner:listOfAntisenseRNAs/>\n<celldesigner:listOfLayers/>\n<celldesigner:listOfBlockDiagrams/>\n</celldesigner:extension>\n</annotation>\n' +
  '<listOfUnitDefinitions/>\n<listOfCompartments>\n<compartment metaid="default" id="default" size="1" units="volume"/>\n<compartment metaid="c1" id="c1" name="cell" size="1" units="volume" outside="default">\n<notes>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head>\n<title/>\n</head>\n<body>Glyph: glyphs/svgcell.png\n</body>\n</html>\n</notes>\n<annotation>\n<celldesigner:extension>\n<celldesigner:name>cell</celldesigner:name>\n</celldesigner:extension>\n</annotation>\n</compartment>\n</listOfCompartments>\n</model>\n</sbml>\n';
// the SVG: a square of 300 by 300 drawn into the compartment's 300 by 100 box (stretched as the editor draws it), a
// black bar of 6 units under a line of 6-unit text
var SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="#c8e6c9"/><rect x="20" y="150" width="100" height="18" fill="#000"/><text x="150" y="160" font-family="Arial" font-size="18" fill="#000">small text</text></svg>';
var GRAPHML = fs.readFileSync(path.join(__dirname, 'rules-cases', 'base.graphml'));   // a yEd map
(async function () {
  var AD = fs.readFileSync(path.join(zips, 'AD_UC_comparison.zip')), AS = fs.readFileSync(path.join(zips, 'asthma_map_bg.zip'));
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }), page = await ctx.newPage(), errs = [], said = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  page.on('dialog', function (d) { said.push(d.message()); d.accept().catch(function () {}); });
  if (local) {
    var ed = require('./editor-now.js')(here), hunks = viewerHunks();
    await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await page.route(function (u) { return u.href.split('#')[0] === base.split('#')[0]; }, async function (r) {
      var res = await r.fetch(), t = await res.text();
      hunks.forEach(function (h) { if (t.indexOf(h[0]) >= 0) t = t.replace(h[0], function () { return h[1]; }); });
      r.fulfill({ response: res, body: t, headers: Object.assign({}, res.headers(), { 'content-type': 'text/html; charset=utf-8' }) });
    });
  }
  var ready = async function () {
    await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000);
    if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]');
    await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 });
  };
  var groupMaps = function (g) { return page.evaluate(function (g) { return Array.prototype.filter.call(document.querySelectorAll('#m2-list .m2-map:not(.m2-binned)'), function (x) { return x.dataset.group === g; }).map(function (x) { return x.querySelector('.m2-name').textContent + (x.querySelector('.m2-top') ? ' [top level]' : ''); }); }, g); };
  var marks = function () { return page.$$eval('#m2-list .m2-map .m2-top', function (l) { return l.map(function (x) { var m = x.closest('.m2-map'); return m.dataset.group + '/' + m.querySelector('.m2-name').textContent + ':' + x.textContent; }); }); };
  var settle = async function (until, ms) { var s = Date.now(); while (Date.now() - s < (ms || 120000)) { if (await until()) return true; await page.waitForTimeout(1000); } return false; };
  var row = function (g, name) { return '#m2-list .m2-map[data-group="' + g + '"]:has(.m2-name:text-is("' + name + '"))'; };
  var menuItems = function () { return page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); };
  var download = async function (sel, item, opts) {   // right-click sel, choose item: the file downloaded, or null
    await page.click(sel, Object.assign({ button: 'right' }, opts || {})); await page.waitForTimeout(400);
    var items = await menuItems(), dl = page.waitForEvent('download', { timeout: 120000 }).catch(function () { return null; });
    if (items.indexOf(item) < 0) { await page.keyboard.press('Escape'); return { file: null, items: items }; }
    await page.click('.m2-cx button:text-is("' + item + '")');
    var d = await dl; if (!d) return { file: null, items: items };
    var f = path.join(tmp, d.suggestedFilename()); await d.saveAs(f); return { file: f, name: d.suggestedFilename(), items: items };
  };
  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); indexedDB.deleteDatabase('atlas-edit-drafts'); });
  await page.reload({ waitUntil: 'load' }); await ready();
  // 1
  await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
  var ch = page.waitForEvent('filechooser'); await page.click('.m2-cx button:text-is("Add map from file")');
  await (await ch).setFiles([{ name: 'AD_UC_comparison.zip', mimeType: 'application/zip', buffer: AD }, { name: 'asthma_map_bg.zip', mimeType: 'application/zip', buffer: AS }]);
  await settle(async function () { return (await groupMaps('asthma_map_bg')).length === 19 && (await marks()).length === 2; }, 600000);
  var mk = await marks();
  ok('1. the first map of each project marked top level, no other', mk.sort().join('|') === 'AD_UC_comparison/AD_UC_comparison:top level|asthma_map_bg/map:top level', mk.join(' | '));
  // 2
  said = [];
  var whole = await download('#m2-list .m2-group[data-group="asthma_map_bg"]', 'Download as MINERVA zip');
  ok('2. the group\'s heading offers it', whole.items.indexOf('Download as MINERVA zip') >= 0, whole.items.join(' | '));
  var cmp = whole.file ? py(['compare', path.join(refs, 'ref-asthma_map_bg.zip'), whole.file]) : { status: 1, stdout: 'nothing downloaded ' + said.join(' ') };
  ok('2. the whole group: the same files byte for byte as minerva_zip.py pack', cmp.status === 0 && / only in the first: 0 /.test(cmp.stdout), cmp.stdout.trim());
  ok('2. named after the group, nothing said', whole.name === 'asthma_map_bg.zip' && !said.length, whole.name + ' ' + said.join(' | '));
  // 3
  await page.click(row('asthma_map_bg', 'AF03 B Cell'), { button: 'right' }); await page.waitForTimeout(300);
  var it3 = await menuItems();
  await page.click('.m2-cx button:text-is("Set as top level")').catch(function () {});
  await page.waitForTimeout(1500);
  var after = await groupMaps('asthma_map_bg');
  ok('3. Set as top level: the map first, the mark with it', after[0] === 'AF03 B Cell [top level]' && after[1] === 'map', after.slice(0, 3).join(' | ') + ' / ' + it3.join(' | '));
  await page.click(row('asthma_map_bg', 'AF05 Eosinophil'));   // a press in the list: the keys go to the list's undo
  await page.waitForTimeout(800);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(1500);
  var undone = await groupMaps('asthma_map_bg');
  ok('3. undone by Cmd+Z: the top level back, its mark too', undone[0] === 'map [top level]' && undone.indexOf('AF03 B Cell') > 0, undone.slice(0, 3).join(' | '));
  // 4
  said = [];
  var one = await download(row('AD_UC_comparison', 'AD_UC_comparison'), 'Download as MINERVA zip');
  var n1 = one.file ? names(one.file) : [];
  ok('4. one map: at the root with its own pictures, no kept file', n1[0] === 'AD_UC_comparison.xml' && n1.filter(function (n) { return /^glyphs\//.test(n); }).length === 18 && n1.indexOf('submaps/mapping.xml') < 0, n1.length + ' ' + n1.slice(0, 3).join(' | '));
  ok('4. the project\'s other files said left out', said.length === 1 && /other files .* left out/.test(said[0]), said.join(' | '));
  if (one.file) {   // AD/UC's pictures of other proportions than their boxes (MINERVA draws them fitted from the top-left corner): resampled to the box's
    var adMap = member(one.file, 'AD_UC_comparison.xml').toString(), adPng = member(one.file, 'glyphs/d7.png');
    var cBox = /compartment="c2"[\s\S]*?<celldesigner:bounds x="[^"]*" y="[^"]*" w="([^"]*)" h="([^"]*)"/.exec(adMap), pw = adPng.readUInt32BE(16), ph = adPng.readUInt32BE(20);
    var orig = cp.execFileSync('unzip', ['-p', path.join(zips, 'AD_UC_comparison.zip'), 'glyphs/d7.png'], { maxBuffer: 1 << 26 }), ow = orig.readUInt32BE(16), oh = orig.readUInt32BE(20);
    ok('4. a picture of other proportions made in its box\'s, no side smaller, said', Math.abs(pw / ph - cBox[1] / cBox[2]) / (cBox[1] / cBox[2]) < 0.01 && pw >= ow && ph >= oh && /made in the proportions of their boxes/.test(said[0]), ow + 'x' + oh + ' to ' + pw + 'x' + ph + ' for a box ' + cBox[1] + 'x' + cBox[2] + ' / ' + said.join(' | '));
    var same = names(one.file).filter(function (n) { return /^glyphs\//.test(n); }).filter(function (n) { return member(one.file, n).equals(cp.execFileSync('unzip', ['-p', path.join(zips, 'AD_UC_comparison.zip'), n], { maxBuffer: 1 << 26 })); });
    ok('4. the pictures within 5% of their boxes byte for byte', same.length > 0, same.length + ' of 18 byte for byte');
  }
  // 5
  await page.click(row('asthma_map_bg', 'AF05 Eosinophil')); await page.waitForTimeout(300);
  await page.click(row('asthma_map_bg', 'AF03 B Cell'), { modifiers: ['Meta'] }); await page.waitForTimeout(300);
  var two = await download(row('asthma_map_bg', 'AF03 B Cell'), 'Download 2 maps as MINERVA zip');
  var n2 = two.file ? names(two.file) : [];
  ok('5. two maps: the first in the list at the root, the other in submaps/', n2[0] === 'AF03 B Cell.xml' && n2[1] === 'submaps/AF05 Eosinophil.xml' && n2.filter(function (n) { return /\.xml$/.test(n); }).length === 2, n2.slice(0, 4).join(' | ') + ' / ' + two.items.join(' | '));
  await page.keyboard.press('Escape');
  // 6: a picture kept as SVG in this browser, a map naming it added from a file
  await page.evaluate(function (svg) {
    return new Promise(function (res) {
      var q = indexedDB.open('atlas-edit-drafts');
      q.onsuccess = function () { var tx = q.result.transaction('folder', 'readwrite'); tx.objectStore('folder').put({ id: 'mz-pictures', glyphs: { 'glyphs/svgcell.svg': new Blob([svg], { type: 'image/svg+xml' }) }, at: Date.now() }, 'minerva:mz-pictures'); tx.oncomplete = function () { q.result.close(); res(); }; tx.onerror = function () { q.result.close(); res(); }; };   // closed, else the page's next opening of the database waits on it
      q.onerror = res;
    });
  }, SVG);
  await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
  ch = page.waitForEvent('filechooser'); await page.click('.m2-cx button:text-is("Add map from file")');
  await (await ch).setFiles([{ name: 'svg cell.xml', mimeType: 'text/xml', buffer: Buffer.from(CD) }, { name: 'plain.graphml', mimeType: 'text/xml', buffer: GRAPHML }]);
  await settle(async function () { return !!(await page.$('#m2-list .m2-map:has(.m2-name:text-is("svg cell"))')) && !!(await page.$('#m2-list .m2-map:has(.m2-name:text-is("plain"))')); }, 60000);
  said = [];
  var sv = await download('#m2-list .m2-map:has(.m2-name:text-is("svg cell"))', 'Download as MINERVA zip');
  var n6 = sv.file ? names(sv.file) : [];
  ok('6. the map and its picture as a PNG, no SVG', n6.join('|') === 'svg cell.xml|glyphs/svgcell.png', n6.join(' | ') + ' ' + said.join(' | '));
  if (sv.file && n6.length === 2) {
    var png = member(sv.file, 'glyphs/svgcell.png'), xml = member(sv.file, 'svg cell.xml').toString();
    var m = await page.evaluate(function (b64) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () {
          var c = document.createElement('canvas'); c.width = im.width; c.height = im.height; var g = c.getContext('2d'); g.drawImage(im, 0, 0);
          var d = g.getImageData(0, 0, im.width, im.height).data, dark = function (x, y) { var i = (y * im.width + x) * 4; return d[i] < 60 && d[i + 1] < 60 && d[i + 2] < 60 && d[i + 3] > 200; };
          var rows = function (x0, x1) { var ys = []; for (var y = 0; y < im.height; y++) for (var x = x0; x < x1; x++) if (dark(x, y)) { ys.push(y); break; } return ys.length ? [ys[0], ys[ys.length - 1]] : null; };
          res({ w: im.width, h: im.height, bar: rows(0, Math.round(im.width * 0.45)), text: rows(Math.round(im.width * 0.5), im.width) });
        };
        im.onerror = function () { res(null); };
        im.src = 'data:image/png;base64,' + b64;
      });
    }, png.toString('base64'));
    ok('6. the PNG at 2 pixels a map unit of the box, its proportions (300 by 100 units: 600 by 200)', m && m.w === 600 && m.h === 200, JSON.stringify(m));
    var barH = m && m.bar ? m.bar[1] - m.bar[0] + 1 : 0;   // 18 SVG units of 300, stretched to 100 units of box: 6 units, 12 px
    ok('6. stretched to the box as the editor draws it: an 18-unit bar of the SVG is 6 units of the box, 12 px', barH >= 11 && barH <= 13, 'bar ' + barH + ' px');
    var txH = m && m.text ? m.text[1] - m.text[0] + 1 : 0;   // a 6-unit font: letters of about 8 px (no descender in "small text")
    ok('6. the smallest text, 6 units, readable: letters about 8 px tall', txH >= 6 && txH <= 11, 'text ' + txH + ' px');
    ok('6. the compartment\'s Z-Index written in the zip, after its Glyph line, and said', /Glyph: glyphs\/svgcell\.png\nZ-Index: -2\n/.test(xml) && said.some(function (s) { return /Z-Index/.test(s); }), said.join(' | '));
  }
  var stored = await page.evaluate(function () { return new Promise(function (res) { var q = indexedDB.open('atlas-edit-drafts'); q.onsuccess = function () { var all = q.result.transaction('mine').objectStore('mine').getAll(); all.onsuccess = function () { q.result.close(); res(all.result.filter(function (r) { return r && r.title === 'svg cell'; }).map(function (r) { return r.text; })[0] || null); }; all.onerror = function () { res('err'); }; }; q.onerror = function () { res('no db'); }; }); }).catch(function (e) { return String(e); });
  ok('6. the map kept here unchanged by the pack', stored === CD, stored ? stored.length + ' chars' : String(stored));
  // 7
  await page.click('#m2-list .m2-map:has(.m2-name:text-is("svg cell"))'); await page.waitForTimeout(300);
  await page.click('#m2-list .m2-map:has(.m2-name:text-is("plain"))', { modifiers: ['Meta'] }); await page.waitForTimeout(300);
  said = [];
  var mix = await download('#m2-list .m2-map:has(.m2-name:text-is("plain"))', 'Download 2 maps as MINERVA zip');
  ok('7. a GraphML map among them: refused, nothing downloaded, the map named', !mix.file && said.some(function (s) { return /the map plain is GraphML: only CellDesigner maps go into a MINERVA zip/.test(s); }), said.join(' | ') + ' / ' + mix.items.join(' | '));
  ok('no page errors', !errs.length, errs.join(' | '));
  await b.close();
})().catch(function (e) { bad++; console.log('WRONG ' + e.stack); }).then(function () {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
});
