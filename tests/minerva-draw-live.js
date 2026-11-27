// A MINERVA project's pictures drawn where the person works (step 2 of the pack, notes/minerva-pack-plan.md): opened
// by Add map from file as a person outside would, its maps drawn with their pictures in the list's picture and in the
// editor, from each place the pictures are kept.
//   1. No token: AsthmaMap and AD/UC picked together. The list's picture of AsthmaMap's top level holds its overview
//      under everything and its 18 buttons, each in place of its shape and name; AD/UC's its compartments, two titles
//      and logo. Edit mode: the editor's drawing the same; a move drawn again with them.
//   2. The page opened again (nothing held from the zip): edit mode and a move, the pictures read from this browser.
//   3. A folder: the zip in it opened on the next visit; the browser's copy of the pictures removed, the page opened
//      again: edit mode and a move, the pictures read from the folder's glyphs/.
//   4. With a token (GitHub played here): the zip sent; the page opened again, nothing kept in this browser: edit mode
//      and a move, the pictures read from maps/glyphs/ on GitHub.
//   5. HIDmap's overview: its picture under the boxes (no Z-Index). Then AsthmaMap opened in the same page: its own
//      overview.png, another picture of the same name, numbered (overview-2.png) and drawn, not HIDmap's.
//   [FROM3=1] node tests/minerva-draw-live.js <folder of the zips> [base address] [--local]   (FROM3: cases 3 to 5 only)
// The zips: pathwayforge sources/minerva/ (open projects). --local: the editor and the renderers of the working tree
// routed into the live page (run styles/update.sh first).
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var zips = process.argv[2], base = process.argv[3] && process.argv[3][0] !== '-' ? process.argv[3] : 'https://viewer-source.github.io/styles/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..'), bad = 0;
var t0 = Date.now(), ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '') + '  (' + Math.round((Date.now() - t0) / 1000) + ' s)'); };
(async function () {
  var AD = fs.readFileSync(path.join(zips, 'AD_UC_comparison.zip')), AS = fs.readFileSync(path.join(zips, 'asthma_map_bg.zip')), HD = fs.readFileSync(path.join(zips, 'HIDmap_v14.zip'));
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [], said = [];
  page.on('pageerror', function (e) { errs.push(e.message || String(e.stack || e)); });
  page.on('dialog', function (d) { if (d.type() !== 'beforeunload') said.push(d.type() + ': ' + d.message()); d.accept().catch(function () {}); });   // beforeunload: a move in 4 not saved to the GitHub played here (no file saving played), rightly held on leaving
  if (local) {
    var ed = require('./editor-now.js')(here);
    await page.route(/\/styles\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await page.route(/\/renderers\/converter\/(cdrender|cd_edit)\.js/, function (r) {
      var f = /\/(cdrender|cd_edit)\.js/.exec(r.request().url())[1];
      r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(here, 'renderers', 'converter', f + '.js'), 'utf8') });
    });
  }
  var ready = async function () {
    await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000);
    if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]');
    await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 });
  };
  var settle = async function (until, ms) { var t0 = Date.now(); while (Date.now() - t0 < (ms || 120000)) { if (await until()) return true; await page.waitForTimeout(1000); } return false; };
  var groupMaps = function (g) {
    return page.evaluate(function (g) { return Array.prototype.filter.call(document.querySelectorAll('#m2-list .m2-map:not(.m2-binned)'), function (x) { return x.dataset.group === g; }).map(function (x) { return x.querySelector('.m2-name').textContent; }); }, g);
  };
  var pick = async function (files) {
    await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
    var ch = page.waitForEvent('filechooser'); await page.click('.m2-cx button:text-is("Add map from file")');
    await (await ch).setFiles(files);
  };
  var records = function () {   // the reader's maps kept in this browser: title, group, the drawing's pictures in order
    return page.evaluate(function () { return new Promise(function (res) { var q = indexedDB.open('atlas-edit-drafts'); q.onsuccess = function () { var g = q.result.transaction('mine').objectStore('mine').getAll(); g.onsuccess = function () { res(g.result.filter(function (r) { return r && r.svg; }).map(function (r) {
          // a node's picture is its own <image> or a <use> of one kept once in <defs> (an image shared by several nodes, cdrender shared)
          var d = r.svg.indexOf('</defs>'), body = d >= 0 ? r.svg.slice(d) : r.svg, fst = body.search(/<(image|use) /), lst = Math.max(body.lastIndexOf('<image '), body.lastIndexOf('<use '));
          return { title: r.title, group: r.group, pics: (body.match(/<image href="data:image\/png;base64,[^"]{20}/g) || []).length + (body.match(/<use href="#m2img-/g) || []).length, under: fst >= 0 && fst < body.indexOf('<g data-n='), over: lst > body.lastIndexOf('<g data-n='), names: />pathway 1<|>ATOPIC DERMATITIS<|>LOGO</.test(r.svg), glyphs: (r.text.match(/Glyph: ?glyphs\/[^\s<]+/g) || []).join(' '), first: (/<image href="(data:[^"]{0,200})/.exec(r.svg) || [])[1] || '' }; })); }; }; }); });
  };
  var open = async function (group, title) {   // a map of the list shown
    await page.evaluate(function (q) { var x = Array.prototype.filter.call(document.querySelectorAll('#m2-list .m2-map:not(.m2-binned)'), function (m) { return m.dataset.group === q[0] && m.querySelector('.m2-name').textContent === q[1]; })[0]; if (x) x.click(); }, [group, title]);
    await page.waitForTimeout(2500);
  };
  var editPics = async function () {   // edit mode on the map shown, then all moved by an arrow: the pictures in the editor's drawing before and after
    await page.keyboard.press('e');
    await page.waitForFunction(function () { return document.querySelector('.m2-editing') !== null; }, null, { polling: 100, timeout: 60000 });
    await page.waitForTimeout(3000);
    var count = function () { return page.evaluate(function () { var p = document.getElementById('m2-img'); return p && p.tagName.toLowerCase() === 'svg' ? Array.prototype.filter.call(p.querySelectorAll('image'), function (i) { return !i.closest('symbol') && /^data:image\/(png|svg)/.test(i.getAttribute('href') || ''); }).length + p.querySelectorAll('use[href^="#m2img-"]').length : -1; }); };   // its own <image>, or a <use> of a shared one
    var at = await count(), before = await page.evaluate(function () { return document.getElementById('m2-img').innerHTML.length; });
    await page.click('#m2-img', { position: { x: 5, y: 5 } }).catch(function () {});
    await page.keyboard.press('Control+a'); await page.keyboard.press('ArrowRight');
    await settle(function () { return page.evaluate(function (n) { var p = document.getElementById('m2-img'); return p && p.innerHTML.length !== n; }, before); }, 60000);
    await page.waitForTimeout(2000);
    var after = await count(), warn = await page.evaluate(function () { return (document.querySelector('#m2-ed-status') || {}).textContent || ''; });
    await page.keyboard.press('Escape'); await page.keyboard.press('e'); await page.waitForTimeout(1500);
    return { at: at, after: after, warn: warn };
  };
  var dropBrowserPictures = function () {   // the projects' pictures kept in this browser taken out (another place must give them)
    return page.evaluate(function () { return new Promise(function (res) { var q = indexedDB.open('atlas-edit-drafts'); q.onsuccess = function () { var t = q.result.transaction('folder', 'readwrite'), st = t.objectStore('folder'), g = st.getAllKeys(); g.onsuccess = function () { g.result.filter(function (k) { return /^minerva:/.test(k); }).forEach(function (k) { st.delete(k); }); }; t.oncomplete = function () { q.result.close(); res(); }; }; }); });
  };
  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); indexedDB.deleteDatabase('atlas-edit-drafts'); });
  await page.reload({ waitUntil: 'load' }); await ready();
  if (!process.env.FROM3) {   // FROM3=1: cases 3 to 5 only
  // 1
  await pick([{ name: 'asthma_map_bg.zip', mimeType: 'application/zip', buffer: AS }, { name: 'AD_UC_comparison.zip', mimeType: 'application/zip', buffer: AD }]);
  await settle(async function () { return (await groupMaps('AD_UC_comparison')).length === 1 && (await groupMaps('asthma_map_bg')).length === 19 && !(await page.$('#m2-list .m2-wait')); }, 300000);
  var rs = await records(), top = rs.filter(function (r) { return r.group === 'asthma_map_bg' && r.title === 'map'; })[0], adr = rs.filter(function (r) { return r.group === 'AD_UC_comparison'; })[0];
  var cells = rs.filter(function (r) { return r.group === 'asthma_map_bg' && r.title !== 'map'; });
  ok('1. AsthmaMap top level in the list: overview under everything, 18 buttons, no button name', top && top.pics === 19 && top.under && !top.names, JSON.stringify(top));
  var af = cells.filter(function (r) { return /^AF/.test(r.title); }), pd = cells.filter(function (r) { return /^PD/.test(r.title); });   // the two PD maps name no background
  ok('1. AsthmaMap\'s 16 cell maps: each its background under everything; its 2 PD maps none', af.length === 16 && af.every(function (r) { return r.pics === 1 && r.under; }) && pd.length === 2 && pd.every(function (r) { return r.pics === 0 && !r.glyphs; }), cells.map(function (r) { return r.title.slice(0, 4) + ':' + r.pics; }).join(','));
  ok('1. AD/UC in the list: compartments, two titles and the logo, no title name', adr && adr.pics === 31 && !adr.names, JSON.stringify(adr));
  await open('asthma_map_bg', 'map');
  await page.screenshot({ path: path.join(process.env.SHOTS || '/tmp', 'minerva-draw-asthma-view.png') });
  var e1 = await editPics();
  ok('1. edit mode: the editor\'s drawing with the 19 pictures; a move drawn again with them', e1.at === 19 && e1.after === 19 && !/Not drawn|Cannot/.test(e1.warn), JSON.stringify(e1));
  // 2
  await page.reload({ waitUntil: 'load' }); await ready();
  await open('AD_UC_comparison', 'AD_UC_comparison');
  var e2 = await editPics();
  ok('2. the page opened again: edit mode and a move with the 31 pictures, read from this browser', e2.at === 31 && e2.after === 31, JSON.stringify(e2));
  ok('no message box, no script errors (no token)', !said.length && !errs.length, said.concat(errs).join(' | '));
  }
  // 3: a folder (the browser's private file system handed out as the chosen folder)
  await page.evaluate(function () {   // this browser's maps and records emptied in place (made as the page makes it when there is none)
    localStorage.clear();
    return new Promise(function (res, rej) { var q = indexedDB.open('atlas-edit-drafts', 3); q.onupgradeneeded = function () { ['maps', 'folder', 'mine'].forEach(function (n) { if (!q.result.objectStoreNames.contains(n)) q.result.createObjectStore(n); }); }; q.onsuccess = function () { var d = q.result, ns = Array.prototype.slice.call(d.objectStoreNames); var t = d.transaction(ns, 'readwrite'); ns.forEach(function (n) { t.objectStore(n).clear(); }); t.oncomplete = function () { d.close(); res(); }; t.onerror = function () { rej(t.error); }; }; q.onerror = function () { rej(q.error); }; });
  });
  await page.reload({ waitUntil: 'load' }); await ready();
  await page.evaluate(function (b64) {
    var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return navigator.storage.getDirectory().then(function (r) { return r.removeEntry('maps', { recursive: true }).catch(function () {}).then(function () { return r.getDirectoryHandle('maps', { create: true }); }); })
      .then(function (d) { return d.getFileHandle('Skin study.zip', { create: true }).then(function (h) { return h.createWritable(); }).then(function (w) { return w.write(u).then(function () { return w.close(); }); }).then(function () { return d; }); })
      .then(function (d) {
        localStorage.setItem('atlas-edit-folder', 'maps');
        return new Promise(function (res, rej) { var q = indexedDB.open('atlas-edit-drafts'); q.onsuccess = function () { try { var t = q.result.transaction('folder', 'readwrite'); t.objectStore('folder').put(d, 'dir'); t.objectStore('folder').put({}, 'files'); t.oncomplete = function () { q.result.close(); res(); }; t.onerror = rej; } catch (e) { rej(e); } }; });
      });
  }, AD.toString('base64'));
  await page.reload({ waitUntil: 'load' }); await ready();
  await settle(async function () { return (await groupMaps('Skin study')).length === 1; }, 60000); await page.waitForTimeout(4000);
  await dropBrowserPictures();
  await page.reload({ waitUntil: 'load' }); await ready();
  await open('Skin study', 'AD_UC_comparison');
  var e3 = await editPics();
  ok('3. a folder: edit mode and a move with the 31 pictures, read from its glyphs/', (await groupMaps('Skin study')).length === 1 && e3.at === 31 && e3.after === 31, JSON.stringify(e3));
  ok('no message box, no script errors (folder)', !said.length && !errs.length, said.concat(errs).join(' | '));
  // 4: a token, GitHub played here (a repository in memory)
  var files = {}, trees = {}, commits = 0, blobs = {}, shas = {}, blobGets = 0;
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '', meth = r.method();
    var json = function (st, o) { return route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    if (rest === '') return json(200, { permissions: { push: true } });
    if (rest === '/contents/maps') return json(200, Object.keys(files).filter(function (p) { return /^maps\/[^/]+$/.test(p); }).map(function (p) { return { name: p.slice(5), path: p, type: 'file', sha: shas[p] }; }));
    if (rest === '/contents/maps/glyphs') return json(200, Object.keys(files).filter(function (p) { return /^maps\/glyphs\/[^/]+$/.test(p); }).map(function (p) { return { name: p.slice(12), path: p, type: 'file', sha: shas[p] }; }));
    if (/^\/git\/blobs\/[^/]+$/.test(rest) && meth === 'GET') { blobGets++; var bb = blobs[rest.slice(11)]; return bb ? json(200, { content: Buffer.from(bb).toString('base64'), encoding: 'base64' }) : json(404, { message: 'Not Found' }); }
    if (rest === '/git/ref/heads/main') return json(200, { object: { sha: 'c' + commits } });
    if (/^\/git\/commits\/c\d+$/.test(rest)) return json(200, { tree: { sha: 't' + commits } });
    if (rest === '/git/blobs' && meth === 'POST') { var bl = JSON.parse(r.postData()), id = 'b' + Object.keys(blobs).length; blobs[id] = bl.encoding === 'base64' ? Buffer.from(bl.content, 'base64') : bl.content; return json(201, { sha: id }); }
    if (rest === '/git/trees' && meth === 'POST') { var tid = 'n' + Object.keys(trees).length; trees[tid] = JSON.parse(r.postData()).tree; return json(201, { sha: tid }); }
    if (rest === '/git/commits' && meth === 'POST') { trees['c:' + (commits + 1)] = trees[JSON.parse(r.postData()).tree]; return json(201, { sha: 'c' + (commits + 1) }); }
    if (rest === '/git/refs/heads/main' && meth === 'PATCH') { commits++; trees['c:' + commits].forEach(function (e) { files[e.path] = e.sha ? blobs[e.sha] : e.content; shas[e.path] = e.sha || 'x'; }); return json(200, {}); }
    if (/^\/contents\/maps\/[^/]+$/.test(rest) && meth === 'GET') { var fp = rest.slice(10); return files[fp] != null ? json(200, { content: Buffer.from(files[fp]).toString('base64'), encoding: 'base64', sha: shas[fp], path: fp }) : json(404, { message: 'Not Found' }); }
    return json(404, { message: 'Not Found' });
  });
  await page.evaluate(function () { localStorage.clear(); indexedDB.deleteDatabase('atlas-edit-drafts'); localStorage.setItem('atlas-edit-token', 'test-token'); });
  await page.reload({ waitUntil: 'load' }); await ready();
  await pick([{ name: 'AD_UC_comparison.zip', mimeType: 'application/zip', buffer: AD }]);
  await settle(function () { return Promise.resolve(commits > 0); }, 60000); await page.waitForTimeout(3000);
  var sent = (await records()).filter(function (r) { return /^AD_UC_comparison/.test(r.group); })[0];
  ok('4. a token: the list\'s picture of the map sent drawn with its 31 pictures', sent && sent.pics === 31, JSON.stringify(sent));
  await dropBrowserPictures();
  await page.reload({ waitUntil: 'load' }); await ready();
  await open(sent ? sent.group : 'AD_UC_comparison', 'AD_UC_comparison');
  var e4 = await editPics();
  ok('4. the page opened again: edit mode and a move with the 31 pictures, read from GitHub', e4.at === 31 && e4.after === 31 && blobGets > 0, JSON.stringify(e4) + ', ' + blobGets + ' pictures fetched');
  ok('no message box, no script errors (token)', !said.length && !errs.length, said.concat(errs).join(' | '));
  // 5
  await page.evaluate(function () { localStorage.clear(); indexedDB.deleteDatabase('atlas-edit-drafts'); });
  await page.unroute('https://api.github.com/**');
  await page.reload({ waitUntil: 'load' }); await ready();
  await pick([{ name: 'HIDmap_v14.zip', mimeType: 'application/zip', buffer: HD }]);
  await settle(async function () { return (await groupMaps('HIDmap_v14')).length === 27 && !(await page.$('#m2-list .m2-wait')); }, 600000);
  var ov = (await records()).filter(function (r) { return r.group === 'HIDmap_v14' && r.title === 'overview'; })[0];
  ok('5. HIDmap\'s overview: its picture under the boxes (no Z-Index)', ov && ov.pics === 1 && ov.under && !ov.over, JSON.stringify(ov));
  await pick([{ name: 'asthma_map_bg.zip', mimeType: 'application/zip', buffer: AS }]);
  await settle(async function () { return (await groupMaps('asthma_map_bg')).length === 19 && !(await page.$('#m2-list .m2-wait')); }, 300000);
  var at2 = (await records()).filter(function (r) { return r.group === 'asthma_map_bg' && r.title === 'map'; })[0];
  ok('5. AsthmaMap after HIDmap: its own overview numbered and drawn, not HIDmap\'s', at2 && /glyphs\/overview-2\.png/.test(at2.glyphs) && at2.pics === 19 && ov && at2.first !== ov.first, at2 && at2.glyphs.slice(0, 60));
  await open('HIDmap_v14', 'overview');
  await page.screenshot({ path: path.join(process.env.SHOTS || '/tmp', 'minerva-draw-hidmap-view.png') });
  ok('no message box, no script errors', !said.length && !errs.length, said.concat(errs).join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok'); process.exit(bad ? 1 : 0);
})();
