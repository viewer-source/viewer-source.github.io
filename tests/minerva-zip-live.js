// A MINERVA project zip opened in the editor (own.js openZip), as a person outside would: Add map from file, a drop,
// and a zip put in their folder; kept the three ways maps are kept.
//   1. No token: three open zips picked together with a refused one: each zip a group of its own named after it, the top
//      level first and the submaps after in the zip's order, the top level shown; the refused zip a red row with its
//      reason in the person's words, nothing of it added; pictures, other files and the record in this browser.
//   2. The same zip again: a second group, numbered, its maps maps of their own.
//   3. A drop of a zip on the page: the same as picking it.
//   4. A folder: a zip put in it opened once on the next visit, its maps written beside it, its pictures in glyphs/,
//      its other files and record in .viewer/minerva/; not opened again on the visit after.
//   5. With a token (GitHub played here): one commit with the maps, their pages, the pictures in maps/glyphs/, the
//      other files and the record in maps/minerva/<record>/; a picture of the same name already there as another file
//      numbered, the map's notes following it. The group packed whole as a MINERVA zip: the project's mapping.xml back
//      in it, read from the record on GitHub (the map matched to its record by its id on the site).
//   node tests/minerva-zip-live.js <folder of the zips> [base address] [--local]
// The zips: pathwayforge sources/minerva/ (AD_UC_comparison.zip, asthma_map_bg.zip, HIDmap_v14.zip; open projects). --local: the editor
// and the viewer of the working tree routed into the live page (build the editor first).
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process'), zlib = require('zlib');
var zips = process.argv[2], base = process.argv[3] && process.argv[3][0] !== '-' ? process.argv[3] : 'https://viewer-source.github.io/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..'), bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
function viewerHunks() {
  var d = cp.execFileSync('git', ['diff', '-U2', process.env.REV || 'HEAD', '--', '_includes/atlas-app.html'], { cwd: here, maxBuffer: 1 << 26 }).toString();
  return d.split(/\n(?=@@ )/).slice(1).map(function (h) {
    var o = [], n = [];
    h.split('\n').slice(1).forEach(function (l) { if (l[0] === ' ') { o.push(l.slice(1)); n.push(l.slice(1)); } else if (l[0] === '-') o.push(l.slice(1)); else if (l[0] === '+') n.push(l.slice(1)); });
    return [o.join('\n'), n.join('\n')];
  });
}
function zipOf(entries) {   // a stored zip made here: [[name, text]]
  var parts = [], cd = [], off = 0;
  entries.forEach(function (e) {
    var name = Buffer.from(e[0]), data = Buffer.from(e[1]), h = Buffer.alloc(30), c = Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt32LE(zlib.crc32(data), 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt32LE(zlib.crc32(data), 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    parts.push(h, name, data); cd.push(c, name); off += 30 + name.length + data.length;
  });
  var cdb = Buffer.concat(cd), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cdb.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat(parts.concat([cdb, end]));
}
(async function () {
  var AD = fs.readFileSync(path.join(zips, 'AD_UC_comparison.zip')), AS = fs.readFileSync(path.join(zips, 'asthma_map_bg.zip')), HD = fs.readFileSync(path.join(zips, 'HIDmap_v14.zip'));
  var cdText = cp.execFileSync('unzip', ['-p', path.join(zips, 'AD_UC_comparison.zip'), 'AD_UC_comparison.xml'], { maxBuffer: 1 << 26 }).toString();
  var UNDRAWN = zipOf([['top.xml', fs.readFileSync(path.join(here, '..', 'notes', 'check-files', 'not-gate-one-input-v01.xml'), 'utf8')], ['submaps/broken.xml', '<?xml version="1.0"?><sbml xmlns:celldesigner="http://www.sbml.org/2001/ns/celldesigner"><model><annotation><celldesigner:extension>']]);
  var BADZIP = zipOf([['top.xml', cdText], ['submaps/AF14 Th0.xml', '<?xml version="1.0"?><sbgn xmlns="http://sbgn.org/libsbgn/0.3"><map/></sbgn>']]);
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }), page = await ctx.newPage(), errs = [], said = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  page.on('dialog', function (d) { said.push(d.message()); d.accept().catch(function () {}); });
  if (local) {
    var ed = require('./editor-now.js')(here), hunks = viewerHunks();
    await page.route(/\.io\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
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
  var groupMaps = function (g) {   // the maps the list shows in a group, in its order
    return page.evaluate(function (g) { return Array.prototype.filter.call(document.querySelectorAll('#m2-list .m2-map:not(.m2-binned)'), function (x) { return x.dataset.group === g; }).map(function (x) { return x.querySelector('.m2-name').textContent; }); }, g);
  };
  var groups = function () { return page.$$eval('#m2-list .m2-group.m2-mine', function (l) { return l.map(function (x) { return x.dataset.group; }); }); };
  var stored = function () {
    return page.evaluate(function () { return new Promise(function (res) { var q = indexedDB.open('atlas-edit-drafts'); q.onsuccess = function () { try { var g = q.result.transaction('folder').objectStore('folder').getAll(); g.onsuccess = function () { res(g.result.filter(function (r) { return r && /^mz-/.test(r.id || ''); }).map(function (r) { return { zip: r.zip, maps: r.maps, glyphs: Object.keys(r.glyphs).length, kept: Object.keys(r.kept), size: Object.keys(r.glyphs).reduce(function (n, k) { return n + r.glyphs[k].size; }, 0) }; })); }; } catch (e) { res(String(e)); } }; q.onerror = function () { res('no database'); }; }); });
  };
  var settle = async function (until, ms) { var t0 = Date.now(); while (Date.now() - t0 < (ms || 120000)) { if (await until()) return true; await page.waitForTimeout(1000); } return false; };
  var pick = async function (files) {
    await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
    var ch = page.waitForEvent('filechooser'); await page.click('.m2-cx button:text-is("Add map from file")');
    await (await ch).setFiles(files);
  };
  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); indexedDB.deleteDatabase('atlas-edit-drafts'); });
  await page.reload({ waitUntil: 'load' }); await ready();
  // 1
  await pick([{ name: 'AD_UC_comparison.zip', mimeType: 'application/zip', buffer: AD }, { name: 'asthma_map_bg.zip', mimeType: 'application/zip', buffer: AS }, { name: 'HIDmap_v14.zip', mimeType: 'application/zip', buffer: HD }, { name: 'not-cd.zip', mimeType: 'application/zip', buffer: BADZIP }, { name: 'not-drawn.zip', mimeType: 'application/zip', buffer: UNDRAWN }]);
  await settle(async function () { return (await groupMaps('HIDmap_v14')).length === 27 && !(await page.$('#m2-list .m2-wait:not(.m2-wait-bad)')); }, 600000);
  var hd = await groupMaps('HIDmap_v14');
  ok('1. the third zip too (27 maps, 16 MB)', hd.length === 27 && hd[0] === 'overview' && hd[1] === 'agm_region', hd.slice(0, 3).join(' | '));
  var as = await groupMaps('asthma_map_bg'), ad = await groupMaps('AD_UC_comparison');
  ok('1. each zip a group named after it', (await groups()).indexOf('asthma_map_bg') >= 0 && (await groups()).indexOf('AD_UC_comparison') >= 0, JSON.stringify(await groups()));
  ok('1. the top level first, the submaps after in the zip’s order', as.length === 19 && as[0] === 'map' && as[1] === 'AF01 Airway Epithelial Cell' && as[18] === 'PD02 Eicosanoids' && ad.join() === 'AD_UC_comparison', as.slice(0, 3).join(' | ') + ' ... ' + as[18]);
  var redRows = await page.$$eval('#m2-list .m2-wait-bad', function (l) { return l.map(function (x) { return x.textContent; }); });
  ok('1. a refused zip a red row with its reason, no message box', redRows.length === 2 && /not-cd.*the map AF14 Th0 is SBGN-ML: only CellDesigner projects open here/.test(redRows.join('|')) && /not-drawn.*the map broken cannot be drawn/.test(redRows.join('|')) && !said.length, JSON.stringify(redRows) + JSON.stringify(said));
  ok('1. nothing of a refused zip added, its good top level neither', (await groups()).indexOf('not-cd') < 0 && (await groups()).indexOf('not-drawn') < 0);
  var hash = await page.evaluate(function () { return location.hash.slice(1); }), on = await page.$eval('#m2-list .m2-map.m2-on .m2-name', function (x) { return x.textContent; }).catch(function () { return ''; });
  ok('1. a project’s top level shown', ['map', 'AD_UC_comparison', 'overview'].indexOf(on) >= 0, on + ' ' + hash);
  var st = await stored(), sa = Array.isArray(st) && st.filter(function (r) { return r.zip === 'asthma_map_bg.zip'; })[0], sd = Array.isArray(st) && st.filter(function (r) { return r.zip === 'AD_UC_comparison.zip'; })[0];
  ok('1. pictures and other files kept in this browser', sa && sa.glyphs === 35 && sa.kept.join() === 'submaps/mapping.xml' && sd && sd.glyphs === 18 && sd.kept.join() === 'submaps/mapping.xml' && st.some(function (r) { return r.zip === 'HIDmap_v14.zip' && r.glyphs === 20; }), JSON.stringify(st).slice(0, 300));
  ok('1. the record: each map with its path in the zip', sa && sa.maps.length === 19 && sa.maps[0].path === 'map.xml' && sa.maps[1].path === 'submaps/AF01 Airway Epithelial Cell.xml' && sa.maps[1].file === 'AF01 Airway Epithelial Cell.xml');
  // 2
  await pick([{ name: 'AD_UC_comparison.zip', mimeType: 'application/zip', buffer: AD }]);
  await settle(async function () { return (await groupMaps('AD_UC_comparison 2')).length === 1; }, 60000);
  ok('2. the same zip again: a second group, numbered', (await groupMaps('AD_UC_comparison 2')).join() === 'AD_UC_comparison' && (await groupMaps('AD_UC_comparison')).length === 1, JSON.stringify(await groups()));
  // 3
  await page.evaluate(function (b64) {
    var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    var dt = new DataTransfer(); dt.items.add(new File([u], 'dropped.zip', { type: 'application/zip' }));
    var t = document.querySelector('#m2-list'); t.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, AD.toString('base64'));
  await settle(async function () { return (await groupMaps('dropped')).length === 1; }, 60000);
  ok('3. a zip dropped on the page: a group as when picked', (await groupMaps('dropped')).join() === 'AD_UC_comparison');
  ok('no message box, no script errors (no token)', !said.length && !errs.length, said.concat(errs).join(' | '));
  // 4: a folder (the browser's private file system handed out as the chosen folder)
  await page.evaluate(function (b64) {
    var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return navigator.storage.getDirectory().then(function (r) { return r.removeEntry('maps', { recursive: true }).catch(function () {}).then(function () { return r.getDirectoryHandle('maps', { create: true }); }); })
      .then(function (d) { return d.getFileHandle('Skin study.zip', { create: true }).then(function (h) { return h.createWritable(); }).then(function (w) { return w.write(u).then(function () { return w.close(); }); }).then(function () { return d; }); })
      .then(function (d) {
        localStorage.setItem('atlas-edit-folder', 'maps');
        return new Promise(function (res, rej) { var q = indexedDB.open('atlas-edit-drafts'); q.onsuccess = function () { var t = q.result.transaction('folder', 'readwrite'); t.objectStore('folder').put(d, 'dir'); t.objectStore('folder').put({}, 'files'); t.oncomplete = function () { q.result.close(); res(); }; t.onerror = rej; }; });
      });
  }, AD.toString('base64'));
  await page.reload({ waitUntil: 'load' }); await ready();
  await settle(async function () { return (await groupMaps('Skin study')).length === 1; }, 60000);
  ok('4. a zip in the folder opened as a group on the next visit', (await groupMaps('Skin study')).join() === 'AD_UC_comparison', JSON.stringify(await groups()));
  await page.waitForTimeout(3000);
  var inFolder = await page.evaluate(function () {
    var list = function (d) { var it = d.entries(), out = []; return (function n() { return it.next().then(function (x) { if (x.done) return out; out.push(x.value); return n(); }); })(); };
    var walk = function (d, pre) { return list(d).then(function (es) { return Promise.all(es.map(function (e) { return e[1].kind === 'directory' ? walk(e[1], pre + e[0] + '/') : [pre + e[0]]; })).then(function (a) { return [].concat.apply([], a); }); }); };
    return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps'); }).then(function (m) { return walk(m, ''); });
  });
  var rec = inFolder.filter(function (f) { return /^\.viewer\/minerva\/mz-[^/]+\/record\.json$/.test(f); });
  ok('4. its map written beside it', inFolder.indexOf('AD_UC_comparison.xml') >= 0, inFolder.filter(function (f) { return !/^glyphs\//.test(f); }).join(', '));
  ok('4. its pictures in glyphs/, its other files and record in .viewer/minerva/', inFolder.filter(function (f) { return /^glyphs\/[^/]+\.png$/.test(f); }).length === 18 && rec.length === 1 && inFolder.indexOf(rec[0].replace('record.json', 'submaps/mapping.xml')) >= 0);
  await page.reload({ waitUntil: 'load' }); await ready(); await page.waitForTimeout(8000);
  ok('4. not opened again on the visit after', !(await groups()).some(function (g) { return /^Skin study \d/.test(g); }) && (await groupMaps('Skin study')).length === 1, JSON.stringify(await groups()));
  await page.evaluate(function () { return new Promise(function (res) { var q = indexedDB.open('atlas-edit-drafts'); q.onsuccess = function () { var t = q.result.transaction('folder', 'readwrite'); t.objectStore('folder').put({}, 'files'); t.oncomplete = function () { q.result.close(); res(); }; }; }); });   // the folder chosen again: its record new
  await page.reload({ waitUntil: 'load' }); await ready(); await page.waitForTimeout(8000);
  ok('4. the folder chosen again: the zip not opened a second time', !(await groups()).some(function (g) { return /^Skin study \d/.test(g); }), JSON.stringify(await groups()));
  ok('no message box, no script errors (folder)', !said.length && !errs.length, said.concat(errs).join(' | '));
  // 5: with a token, GitHub played here (a repository in memory)
  var files = { 'maps/glyphs/2.png': 'another picture' }, trees = {}, commits = 0, blobs = {};
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '', meth = r.method();
    var json = function (st, o) { return route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    if (rest === '') return json(200, { permissions: { push: true } });
    if (rest === '/contents/maps') return json(200, Object.keys(files).filter(function (p) { return /^maps\/[^/]+$/.test(p); }).map(function (p) { return { name: p.slice(5), path: p, type: 'file' }; }));
    if (rest === '/contents/maps/glyphs') return json(200, Object.keys(files).filter(function (p) { return /^maps\/glyphs\/[^/]+$/.test(p); }).map(function (p) { return { name: p.slice(12), path: p, type: 'file', sha: 'sha-of-another-picture' }; }));
    if (rest === '/git/ref/heads/main') return json(200, { object: { sha: 'c' + commits } });
    if (/^\/git\/commits\/c\d+$/.test(rest)) return json(200, { tree: { sha: 't' + commits } });
    if (/^\/git\/trees\/[^/]+$/.test(rest) && meth === 'GET') {   // the committed files as trees: the root t<n>, a folder T:<path>
      var tsha = decodeURIComponent(rest.slice(11)), dir = /^t\d+$/.test(tsha) ? '' : tsha.slice(2).replace(/~/g, '/') + '/', deep = u.searchParams.get('recursive') === '1', seenT = {}, tree = [];
      Object.keys(files).filter(function (p) { return p.indexOf(dir) === 0; }).forEach(function (p) {
        var r = p.slice(dir.length), k = r.indexOf('/');
        if (deep || k < 0) tree.push({ path: r, type: 'blob', sha: 'F:' + p });
        if (k > 0 && !seenT[r.slice(0, k)]) { seenT[r.slice(0, k)] = 1; tree.push({ path: r.slice(0, k), type: 'tree', sha: 'T:' + (dir + r.slice(0, k)).replace(/\//g, '~') }); }
      });
      return json(200, { tree: tree, truncated: false });
    }
    if (/^\/git\/blobs\/F:/.test(rest) && meth === 'GET') { var fp = decodeURIComponent(rest.slice(13)); return files[fp] == null ? json(404, {}) : json(200, { content: Buffer.from(files[fp]).toString('base64'), encoding: 'base64' }); }
    if (rest === '/git/blobs' && meth === 'POST') { var bl = JSON.parse(r.postData()), id = 'b' + Object.keys(blobs).length; blobs[id] = bl.encoding === 'base64' ? Buffer.from(bl.content, 'base64') : bl.content; return json(201, { sha: id }); }
    if (rest === '/git/trees' && meth === 'POST') { var tid = 'n' + Object.keys(trees).length; trees[tid] = JSON.parse(r.postData()).tree; return json(201, { sha: tid }); }
    if (rest === '/git/commits' && meth === 'POST') { trees['c:' + (commits + 1)] = trees[JSON.parse(r.postData()).tree]; return json(201, { sha: 'c' + (commits + 1) }); }
    if (rest === '/git/refs/heads/main' && meth === 'PATCH') { commits++; trees['c:' + commits].forEach(function (e) { files[e.path] = e.sha ? blobs[e.sha] : e.content; }); return json(200, {}); }
    return json(404, { message: 'Not Found' });
  });
  await page.evaluate(function () { localStorage.clear(); indexedDB.deleteDatabase('atlas-edit-drafts'); localStorage.setItem('atlas-edit-token', 'test-token'); });   // nothing of 1 to 4 sent
  await page.reload({ waitUntil: 'load' }); await ready();
  var c0 = commits;
  await pick([{ name: 'AD_UC_comparison.zip', mimeType: 'application/zip', buffer: AD }]);
  await settle(function () { return Promise.resolve(commits > c0); }, 60000); await page.waitForTimeout(3000);
  var paths = Object.keys(files), map = paths.filter(function (p) { return /^maps\/[^/]+\.xml$/.test(p); }), recp = paths.filter(function (p) { return /^maps\/minerva\/mz-[^/]+\/record\.json$/.test(p); });
  ok('5. one commit: the map and its page', commits === c0 + 1 && map.length === 1 && files[map[0].replace(/\.xml$/, '.md')] != null, commits + ' commits; ' + map.join());
  ok('5. the map sent as a blob, its text whole', typeof files[map[0]] === 'string' && files[map[0]].length > 100000 && Object.keys(trees).every(function (k) { return trees[k].every(function (e) { return !(/\.xml$/.test(e.path) && e.content); }); }));
  ok('5. the pictures in maps/glyphs/, byte for byte', paths.filter(function (p) { return /^maps\/glyphs\/.+\.png$/.test(p); }).length === 19 && Buffer.isBuffer(files['maps/glyphs/d7.png']) && files['maps/glyphs/d7.png'].equals(Buffer.from(cp.execFileSync('unzip', ['-p', path.join(zips, 'AD_UC_comparison.zip'), 'glyphs/d7.png'], { maxBuffer: 1 << 26 }))));
  ok('5. a picture of a name taken by another file: numbered, the map’s notes following it', files['maps/glyphs/2.png'] === 'another picture' && Buffer.isBuffer(files['maps/glyphs/2-2.png']) && /Glyph: glyphs\/2-2\.png/.test(String(files[map[0]])) && !/Glyph: glyphs\/2\.png/.test(String(files[map[0]])));
  var rj = recp.length === 1 && JSON.parse(files[recp[0]]);
  ok('5. the other files and the record in maps/minerva/<record>/', rj && rj.zip === 'AD_UC_comparison.zip' && rj.maps.length === 1 && 'maps/' + rj.maps[0].id + '.xml' === map[0] && rj.maps[0].path === 'AD_UC_comparison.xml' && Buffer.isBuffer(files[recp[0].replace('record.json', 'submaps/mapping.xml')]), JSON.stringify(rj));
  ok('5. its top level shown', await page.$eval('#m2-list .m2-map.m2-on .m2-name', function (x) { return x.textContent; }).catch(function () { return ''; }) === 'AD_UC_comparison');
  ok('5. the group named after the zip', (await groups()).some(function (g) { return /^AD_UC_comparison/.test(g); }));
  var gAD = (await groups()).filter(function (g) { return /^AD_UC_comparison/.test(g); })[0];
  await page.evaluate(function () { return new Promise(function (res) { setTimeout(res, 61000); }); });   // the records read a minute ago read again
  await page.click('#m2-list .m2-group[data-group="' + gAD + '"]', { button: 'right' }); await page.waitForTimeout(400);
  var it5 = await page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); });
  var dl5 = page.waitForEvent('download', { timeout: 120000 }).catch(function () { return null; });
  if (it5.indexOf('Download as MINERVA zip') >= 0) await page.click('.m2-cx button:text-is("Download as MINERVA zip")'); else await page.keyboard.press('Escape');
  var d5 = await dl5, z5 = d5 && path.join(require('os').tmpdir(), 'mzl5-' + Date.now() + '.zip'); if (d5) await d5.saveAs(z5);
  var n5 = z5 ? cp.spawnSync('python3', ['-I', '-c', 'import sys,zipfile; print("|".join(zipfile.ZipFile(sys.argv[1]).namelist()))', z5], { encoding: 'utf8' }).stdout.trim().split('|') : [];
  if (z5) fs.rmSync(z5, { force: true });
  ok('5. the group packed whole: its mapping.xml back from the record on GitHub', n5[0] === 'AD_UC_comparison.xml' && n5.indexOf('submaps/mapping.xml') >= 0, n5.length + ' files ' + n5.slice(0, 3).join(' | ') + ' / ' + said.join(' | ') + ' / ' + it5.join(' | '));
  said = said.filter(function (x) { return !/^Downloaded as a MINERVA zip/.test(x); });   // what the pack says of the pictures it made
  ok('no message box, no script errors (token)', !said.length && !errs.length, said.concat(errs).join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok'); process.exit(bad ? 1 : 0);
})();
