// Delete group, Restore into the group a map came from, the build's own maps (no page of their own) deleted, Deleted (0).
// GitHub is played by this script (page.route on api.github.com, a repository held in memory), as tests/deleted.js.
//   1. Deleted is there with nothing in it: Deleted (0); its menu offers nothing to delete forever; opened, No deleted maps.
//   2. An SBGN-ML twin deleted on its own: maps/deleted.json says so, its GraphML map stays; the build listing it keeps it
//      in Deleted; Restore takes its line out. Deleted forever: one commit, maps/deleted.json says forever.
//   3. Delete group on a site group (AsthmaMap): every map's page says deleted:, the group gone, Deleted shows maps only;
//      Restore puts a map back into AsthmaMap.
//   4. Delete group on a group of the reader's: the group goes, its map into Deleted; Restore brings the group back with
//      it; Cmd+Z after Delete group brings both back.
//   5. Delete group on a group of the build's own maps: one write to maps/deleted.json, one for its undo.
//   6. A GraphML map and its twin selected and deleted together: the twin goes with it, no line of its own.
//   7. Shift-click on a group's heading selects it; Esc lets it go; the Delete key deletes it, all shown in Deleted at once; Cmd+Z.
//   node tests/delete-group.js [base address] [--local]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/styles/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..');
var gitSha = function (t) { var b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex'); };
function editorNow() {
  var read = function (f) { return fs.readFileSync(path.join(here, 'editor', f), 'utf8'); };
  return read('editor.js').replace(/^---[\s\S]*?---\n/, '').replace(/\{% include_relative (\S+) %\}/g, function (m, f) { return read(f); });
}
function viewerHunks() {
  var d = cp.execFileSync('git', ['diff', '-U2', process.env.REV || 'HEAD', '--', '../styles/_includes/atlas-app.html'], { cwd: here, maxBuffer: 1 << 26 }).toString();
  return d.split(/\n(?=@@ )/).slice(1).map(function (h) {
    var o = [], n = [];
    h.split('\n').slice(1).forEach(function (l) { if (l[0] === ' ') { o.push(l.slice(1)); n.push(l.slice(1)); } else if (l[0] === '-') o.push(l.slice(1)); else if (l[0] === '+') n.push(l.slice(1)); });
    return [o.join('\n'), n.join('\n')];
  });
}
(async function () {
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  page.on('dialog', function (d) { d.accept().catch(function () {}); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  if (local) {
    var ed = editorNow(), hunks = viewerHunks();
    await page.route(/\/styles\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await page.route(function (u) { return u.href.split('#')[0] === base.split('#')[0]; }, async function (r) {
      var res = await r.fetch(), t = await res.text(), miss = 0;
      hunks.forEach(function (h) { if (t.indexOf(h[0]) < 0) miss++; else t = t.replace(h[0], function () { return h[1]; }); });
      if (miss) console.log('WRONG the viewer\'s changes did not apply to the page (' + miss + ' of ' + hunks.length + ')');
      r.fulfill({ response: res, body: t, headers: Object.assign({}, res.headers(), { 'content-type': 'text/html; charset=utf-8' }) });
    });
  }
  var SID = 'copy-of-glycolysis-graphml';
  var files = {}, blobs = {}, trees = {}, commits = 0, puts = [];
  files['maps/' + SID + '.graphml'] = '<graphml/>';
  files['maps/' + SID + '.md'] = '---\ntitle: "Copy of Glycolysis"\ntopic: "Copy of Glycolysis"\ngroup: "Testing"\norder: 3\n---\nIts text.\n';
  files['maps/glycolysis-graphml.md'] = '---\ntitle: "Glycolysis"\ntopic: "Glycolysis"\ngroup: "GraphML"\norder: 1\n---\n';
  files['maps/glycogen-muscle-graphml.md'] = '---\ntitle: "Glycogen metabolism (muscle)"\ntopic: "Glycogen metabolism (muscle)"\ngroup: "GraphML"\norder: 3\n---\n';
  files['maps/glycogen-liver-graphml.md'] = '---\ntitle: "Glycogen metabolism (liver)"\ntopic: "Glycogen metabolism (liver)"\ngroup: "GraphML"\norder: 4\n---\n';
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '', meth = r.method();
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    if (rest === '') return json(200, { permissions: { push: true } });
    if (rest === '/contents/maps') return json(200, Object.keys(files).filter(function (p) { return /^maps\/[^/]+$/.test(p); }).map(function (p) { return { name: p.slice(5), path: p, type: 'file' }; }));
    if (rest === '/git/blobs' && meth === 'POST') { var t = Buffer.from(JSON.parse(r.postData()).content, 'base64').toString('utf8'), s = gitSha(t); blobs[s] = t; return json(201, { sha: s }); }
    if (rest === '/git/ref/heads/main') return json(200, { object: { sha: 'c' + commits } });
    if (/^\/git\/commits\/c\d+$/.test(rest)) return json(200, { tree: { sha: 't' + commits } });
    if (rest === '/git/trees' && meth === 'POST') { var id = 'n' + Object.keys(trees).length; trees[id] = JSON.parse(r.postData()).tree; return json(201, { sha: id }); }
    if (rest === '/git/commits' && meth === 'POST') { var d0 = JSON.parse(r.postData()); trees['c:' + (commits + 1)] = trees[d0.tree]; return json(201, { sha: 'c' + (commits + 1) }); }
    if (rest === '/git/refs/heads/main' && meth === 'PATCH') {
      commits++; (trees['c:' + commits] || []).forEach(function (e) { if (e.sha === null) delete files[e.path]; else files[e.path] = e.content != null ? e.content : blobs[e.sha]; });
      return json(200, {});
    }
    var c = rest.match(/^\/contents\/(.+)$/);
    if (c && meth === 'PUT') {
      var p = decodeURIComponent(c[1]), d = JSON.parse(r.postData());
      puts.push(p);
      if (inFlight || refuseNext) { refuseNext = false; refused++; return json(409, { message: 'test: another write on main' }); }   // as GitHub: two writes on one branch at once, one refused
      inFlight = true; await new Promise(function (ok) { setTimeout(ok, 300); }); inFlight = false;
      if (files[p] != null && d.sha !== gitSha(files[p])) return json(409, { message: 'test: sha does not match' });
      files[p] = Buffer.from(d.content, 'base64').toString('utf8');
      return json(200, { content: { sha: gitSha(files[p]) } });
    }
    if (c) {
      var p2 = decodeURIComponent(c[1]);
      if (files[p2] == null) return json(404, { message: 'Not Found' });
      return json(200, { sha: gitSha(files[p2]), content: Buffer.from(files[p2]).toString('base64') });
    }
    return json(404, { message: 'Not Found' });
  });
  var built = {};   // id -> the deleted date the build would list
  var inFlight = false, refused = 0, refuseNext = false;   // refuseNext: the next write refused once, as when another tab wrote first
  await page.route('**/index.json*', async function (route) {
    var res = await route.fetch(), list = JSON.parse(await res.text());
    list.forEach(function (m) { m.deleted = built[m.id] || ''; if (/^maps\/.+\//.test(m.editPath || '')) m.pageless = true; });   // as build.py marks the maps it makes with no page   // the site's own deletions left out, so the test starts the same
    list.forEach(function (m) { var t = files['maps/' + m.id + '.md'], w = t && t.match(/^written: "(.*)"$/m); if (t != null) m.written = w ? w[1] : ''; });   // as build.py: the page's written: (the viewer waits for a build that new)
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) });
  });
  var ids = function () { return page.$$eval('#m2-list .m2-map:not(.m2-binned)', function (l) { return l.map(function (x) { return x.dataset.id; }); }); };
  var binned = function () { return page.$$eval('#m2-list .m2-binned', function (l) { return l.map(function (x) { return x.dataset.id; }); }); };
  var head = function () { return page.$eval('#m2-list .m2-bin', function (h) { return h.textContent + (h.classList.contains('m2-shut') ? ' shut' : ' open'); }).catch(function () { return ''; }); };
  var recs = function () { return page.evaluate(function () { return new Promise(function (res) { var q = indexedDB.open('atlas-edit-drafts', 3); q.onsuccess = function () { try { var g = q.result.transaction('mine').objectStore('mine').getAll(); g.onsuccess = function () { res(g.result); }; } catch (e) { res([]); } }; q.onerror = function () { res([]); }; }); }); };
  var list = async function () { if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]'); await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 }); };
  var menu = async function (sel, item) {
    await list();
    await page.click(sel, { button: 'right' }); await page.waitForTimeout(300);
    await page.click('.m2-cx button:text-is("' + item + '")'); await page.waitForTimeout(2000);
  };
  var openBin = async function () { if (/shut/.test(await head())) { await page.click('#m2-list .m2-bin'); await page.waitForTimeout(300); } };
  var hash = function () { return page.evaluate(function () { return location.hash.slice(1); }); };
  var load = async function (h) { await page.goto(base + '#' + (h || 'glycolysis-graphml'), { waitUntil: 'load' }); await page.reload({ waitUntil: 'load' });   // the same address with its # alone is no reload
    await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000); };
  var title = function (id) { return page.$eval('#m2-list .m2-map[data-id="' + id + '"] .m2-name', function (x) { return x.textContent; }).catch(function () { return null; }); };

  var mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  var groups = function () { return page.$$eval('#m2-list .m2-group:not(.m2-bin)', function (l) { return l.map(function (x) { return x.dataset.group; }); }); };
  var menuItems = async function (sel) { await list(); await page.click(sel, { button: 'right' }); await page.waitForTimeout(300); var t = await page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); await page.keyboard.press('Escape'); await page.waitForTimeout(200); return t; };
  var binFile = function () { try { return JSON.parse(files['maps/deleted.json'] || '{}'); } catch (e) { return {}; } };
  await page.addInitScript(function () { localStorage.setItem('atlas-edit-token', 'test-token'); });

  // 1. Deleted (0)
  await load(); await list();
  ok('1. Deleted (0) shown, closed', (await head()) === 'Deleted (0) shut', await head());
  var t1 = await menuItems('#m2-list .m2-bin');
  ok('1. its menu: no Delete all forever', t1.indexOf('Delete all forever') < 0, t1.join(', '));
  await openBin();
  ok('1. opened: No deleted maps', !!(await page.$('#m2-list .m2-bin-empty:text-is("No deleted maps")')));
  var t1b = await menuItems('#m2-list .m2-bin-empty');
  ok('1. the empty line\'s menu is the heading\'s (no New map there)', t1b.indexOf('New SBGN-ML map') < 0, t1b.join(', '));

  // 2. a twin alone
  var T = 'glycolysis-sbgn';
  var t2 = await menuItems('#m2-list .m2-map[data-id="' + T + '"]');
  ok('2. Delete map offered on an SBGN-ML twin', t2.indexOf('Delete map') >= 0, t2.join(', '));
  await menu('#m2-list .m2-map[data-id="' + T + '"]', 'Delete map');
  ok('2. maps/deleted.json: the twin in Deleted', !!(binFile()[T] && binFile()[T].deleted && binFile()[T].written), files['maps/deleted.json']);
  ok('2. in Deleted, its GraphML map still listed', (await binned()).indexOf(T) >= 0 && (await ids()).indexOf('glycolysis-graphml') >= 0 && /glycolysis-graphml\.md/.test(Object.keys(files).join(' ')) && !/deleted:/.test(files['maps/glycolysis-graphml.md']));
  built[T] = binFile()[T].deleted;
  await load(); await list(); await openBin();
  ok('2. the build listing it: still in Deleted', (await binned()).indexOf(T) >= 0);
  await menu('#m2-list .m2-binned[data-id="' + T + '"]', 'Restore');
  ok('2. Restore: its line gone from maps/deleted.json, back in SBGN-ML', !binFile()[T] && (await ids()).indexOf(T) >= 0, files['maps/deleted.json']);
  delete built[T];
  await menu('#m2-list .m2-map[data-id="' + T + '"]', 'Delete map');
  await openBin();
  var c2 = commits;
  await menu('#m2-list .m2-binned[data-id="' + T + '"]', 'Delete forever'); await page.waitForTimeout(1500);
  ok('2. Delete forever: one commit, maps/deleted.json says forever, its GraphML map kept', commits === c2 + 1 && binFile()[T] && binFile()[T].deleted === 'forever' && files['maps/glycolysis-graphml.md'] != null && (await binned()).indexOf(T) < 0, commits - c2 + ' ' + files['maps/deleted.json']);

  // 3. a site group
  files['maps/pdh-graphml.md'] = '---\ntitle: "PDH"\ntopic: "PDH"\ngroup: "GraphML"\norder: 2\n---\n';
  ['asthmamap-mast-cell-celldesigner', 'asthmamap-mast-cell-graphml'].forEach(function (id, i) { files['maps/' + id + '.md'] = '---\ntitle: "Mast cell"\ntopic: "Mast cell"\ngroup: "AsthmaMap"\norder: ' + (i + 1) + '\n---\n'; });
  await load(); await list();
  var t3 = await menuItems('#m2-list .m2-group[data-group="AsthmaMap"]');
  ok('3. Delete group offered on a site group', t3.indexOf('Delete group') >= 0, t3.join(', '));
  await menu('#m2-list .m2-group[data-group="AsthmaMap"]', 'Delete group'); await page.waitForTimeout(3000);
  ok('3. both pages say deleted:', /deleted:/.test(files['maps/asthmamap-mast-cell-celldesigner.md']) && /deleted:/.test(files['maps/asthmamap-mast-cell-graphml.md']));
  ok('3. the group gone from the list, Deleted (2)', (await groups()).indexOf('AsthmaMap') < 0 && /^Deleted \(2\)/.test(await head()), (await groups()).join(', ') + ' | ' + await head());
  await openBin();
  await menu('#m2-list .m2-binned[data-id="asthmamap-mast-cell-graphml"]', 'Restore');
  ok('3. Restore: back in AsthmaMap', (await groups()).indexOf('AsthmaMap') >= 0 && (await page.$('#m2-list .m2-map[data-id="asthmamap-mast-cell-graphml"][data-group="AsthmaMap"]')) !== null, (await groups()).join(', '));
  await menu('#m2-list .m2-binned[data-id="asthmamap-mast-cell-celldesigner"]', 'Restore');

  // 4. a group of the reader's
  await page.evaluate(function () { localStorage.setItem('atlas-mine-groups', JSON.stringify(['Mine'])); });
  await load(); await list();
  await menu('#m2-list .m2-empty[data-group="Mine"]', 'New SBGN-ML map'); await page.waitForTimeout(1500);
  var id4 = await hash();
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800);
  ok('4. a map of the reader\'s in Mine', (await page.$('#m2-list .m2-map[data-id="' + id4 + '"][data-group="Mine"]')) !== null);
  var t4 = await menuItems('#m2-list .m2-group[data-group="Mine"]');
  ok('4. Remove group and Delete group offered', t4.indexOf('Remove group') >= 0 && t4.indexOf('Delete group') >= 0, t4.join(', '));
  await menu('#m2-list .m2-group[data-group="Mine"]', 'Delete group');
  ok('4. Mine gone, its map in Deleted', (await groups()).indexOf('Mine') < 0 && (await ids()).indexOf(id4) < 0 && /^Deleted \(1\)/.test(await head()), (await groups()).join(', ') + ' | ' + await head());
  await page.click('#m2-list .m2-map:not(.m2-binned) >> nth=0'); await page.waitForTimeout(500);
  await page.keyboard.press(mod + '+z'); await page.waitForTimeout(2500);
  ok('4. Cmd+Z: Mine back with its map', (await groups()).indexOf('Mine') >= 0 && (await page.$('#m2-list .m2-map[data-id="' + id4 + '"][data-group="Mine"]')) !== null, (await groups()).join(', '));
  await menu('#m2-list .m2-group[data-group="Mine"]', 'Delete group');
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(4000); await list(); await openBin();
  ok('4. after a reload: Mine still gone, the map in Deleted', (await groups()).indexOf('Mine') < 0 && (await binned()).indexOf(id4) >= 0);
  await menu('#m2-list .m2-binned[data-id="' + id4 + '"]', 'Restore');
  ok('4. Restore: Mine back with the map in it', (await groups()).indexOf('Mine') >= 0 && (await page.$('#m2-list .m2-map[data-id="' + id4 + '"][data-group="Mine"]')) !== null, (await groups()).join(', '));

  // 5. a whole group of the build's own maps: one write, and one for its undo
  var G = 'SBGN-ML external AF', inG = await page.$$eval('#m2-list .m2-map[data-group="' + G + '"]', function (l) { return l.map(function (x) { return x.dataset.id; }); });
  var p0 = puts.length;
  await menu('#m2-list .m2-group[data-group="' + G + '"]', 'Delete group'); await page.waitForTimeout(2000);
  var bf = binFile(), w5 = puts.slice(p0).filter(function (p) { return p === 'maps/deleted.json'; }).length;
  ok('5. Delete group on ' + G + ' (' + inG.length + ' maps): one write, every map in maps/deleted.json, the group gone', inG.length > 3 && w5 === 1 && inG.every(function (id) { return bf[id] && bf[id].deleted; }) && (await groups()).indexOf(G) < 0, w5 + ' writes');
  p0 = puts.length;
  await page.click('#m2-list .m2-map:not(.m2-binned) >> nth=0'); await page.waitForTimeout(500);
  await page.keyboard.press(mod + '+z'); await page.waitForTimeout(3000);
  bf = binFile(); w5 = puts.slice(p0).filter(function (p) { return p === 'maps/deleted.json'; }).length;
  ok('5. Cmd+Z: one write, their lines gone, the group back', w5 === 1 && inG.every(function (id) { return !bf[id]; }) && (await groups()).indexOf(G) >= 0, w5 + ' writes');

  // 6. a GraphML map and its twin selected together: the twin goes with it (no line of its own)
  var GT = 'pdh-sbgn';
  await page.click('#m2-list .m2-map[data-id="pdh-graphml"]'); await page.waitForTimeout(500);
  await page.click('#m2-list .m2-map[data-id="' + GT + '"]', { modifiers: [mod] }); await page.waitForTimeout(300);
  await page.click('#m2-list .m2-map[data-id="' + GT + '"]', { button: 'right' }); await page.waitForTimeout(300);
  await page.evaluate(function () { Array.prototype.filter.call(document.querySelectorAll('.m2-cx button'), function (x) { return /^Delete \d+ maps$/.test(x.textContent); })[0].click(); }); await page.waitForTimeout(2500);
  ok('6. the twin not written on its own, the GraphML map\'s page deleted', !binFile()[GT] && /deleted:/.test(files['maps/pdh-graphml.md'] || ''), files['maps/deleted.json']);
  await page.keyboard.press(mod + '+z'); await page.waitForTimeout(2500);

  // 7. Shift with a click on a group's heading selects the group (not opened or closed); Esc lets it go; the Delete key
  //    deletes it, every map shown in Deleted at once while the pages' writes follow one at a time; Cmd+Z brings it back
  var AM = ['asthmamap-mast-cell-celldesigner', 'asthmamap-mast-cell-graphml'], AH = '#m2-list .m2-group[data-group="AsthmaMap"]';
  await load(); await list();
  var lit = function () { return page.$eval(AH, function (h) { return h.classList.contains('m2-on') + ' ' + h.classList.contains('m2-shut'); }).catch(function () { return 'none'; }); };
  var was7 = await lit();
  await page.click(AH, { modifiers: ['Shift'] }); await page.waitForTimeout(200);
  ok('7. Shift-click on the heading: the group selected, not opened or closed', (await lit()) === 'true ' + was7.split(' ')[1], was7 + ' -> ' + await lit());
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok('7. Esc: the group no longer selected', /^false/.test(await lit()), await lit());
  await page.click(AH, { modifiers: ['Shift'] }); await page.waitForTimeout(200);
  await page.click('#m2-list .m2-map[data-group="GraphML"] >> nth=0'); await page.waitForTimeout(500);
  ok('7. a map opened: the group no longer selected (Delete would be the map\'s)', /^false/.test(await lit()), await lit());
  await page.click(AH, { modifiers: ['Shift'] }); await page.waitForTimeout(200);
  var n7 = function (h) { return +((h.match(/\((\d+)\)/) || [])[1] || 0); }, h7 = await head(), p7 = puts.length;
  await page.keyboard.press('Delete'); await page.waitForTimeout(600);
  ok('7. Delete alone: the group kept, as in Finder', (await groups()).indexOf('AsthmaMap') >= 0, (await groups()).join(', '));
  await page.keyboard.press(mod + '+Delete'); await page.waitForTimeout(150);
  var h7b = await head(), w7 = AM.filter(function (id) { return /deleted:/.test(files['maps/' + id + '.md']); }).length;
  ok('7. ' + mod + '+Delete: the group gone, Deleted 2 more at once (pages written meanwhile: ' + w7 + ')', (await groups()).indexOf('AsthmaMap') < 0 && n7(h7b) === n7(h7) + 2 && w7 < 2, h7 + ' -> ' + h7b);
  await page.waitForTimeout(3000);
  ok('7. both pages say deleted:', AM.every(function (id) { return /deleted:/.test(files['maps/' + id + '.md']); }), puts.slice(p7).join(', '));
  await page.click('#m2-list .m2-map:not(.m2-binned) >> nth=0'); await page.waitForTimeout(300);
  await page.keyboard.press(mod + '+z'); await page.waitForTimeout(3000);
  ok('7. Cmd+Z: AsthmaMap back with both maps', (await groups()).indexOf('AsthmaMap') >= 0 && AM.every(function (id) { return !/deleted:/.test(files['maps/' + id + '.md']); }), (await groups()).join(', '));

  ok('no page errors', !errs.length, errs.join(' | '));
  console.log(bad ? bad + ' WRONG' : 'all ok');
  await b.close();
  process.exit(bad ? 1 : 0);
})();
