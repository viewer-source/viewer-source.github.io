// Delete map, Deleted, Restore, Delete forever. GitHub is played by this script
// (page.route on api.github.com, a repository held in memory).
//   1. No token, a reader's map: Delete map puts it in Deleted (closed, its count), out of the list, no Edit tab on it;
//      its name free for a new map; Restore keeps its own name unless its group has it in that format by then ("(1)", as
//      Finder; tests/names.js); Delete forever takes the record out.
//   2. With a token, a site map: Delete map writes deleted: into its page and shows it in Deleted at once; the build
//      listing it as deleted keeps it there; Restore drops the line; Delete forever removes its files in one commit.
//   3. The same site map deleted, the page opened without a token: not in the list at all.
//   3b. A GraphML map in Deleted with its SBGN-ML twin (no page of its own): Restore on the twin restores the GraphML map.
//   4. An older version's hidden site map (atlas-hidden-maps) moved into Deleted once with a token.
//   5. Cmd+Delete (Ctrl+Delete elsewhere; Delete or Backspace) on the map shown: into Deleted, the next map shown; Delete or
//      Backspace alone: kept, as in Finder; the menu's Delete map shows the key; not while editing, not on a map that cannot
//      be deleted (a site map without a token).
//   6. A heading opened or closed (Deleted, a group) keeps the list where it is, the map shown far above.
//   node tests/deleted.js [base address] [--local]
// --local: the editor and the viewer of the working tree routed into the live page (the page's changes since
// REV, default HEAD; build the editor first), as tests/edit-reload.js
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..');
var gitSha = function (t) { var b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex'); };
function editorNow() {
  return require('./editor-now.js')(here);
}
function viewerHunks() {
  var d = cp.execFileSync('git', ['diff', '-U2', process.env.REV || 'HEAD', '--', '_includes/atlas-app.html'], { cwd: here, maxBuffer: 1 << 26 }).toString();
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
    await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await page.route(function (u) { return u.href.split('#')[0] === base.split('#')[0]; }, async function (r) {
      var res = await r.fetch(), t = await res.text(), miss = 0;
      hunks.forEach(function (h) { if (t.indexOf(h[0]) < 0) miss++; else t = t.replace(h[0], function () { return h[1]; }); });
      if (miss) console.log('WRONG the viewer\'s changes did not apply to the page (' + miss + ' of ' + hunks.length + ')');
      r.fulfill({ response: res, body: t, headers: Object.assign({}, res.headers(), { 'content-type': 'text/html; charset=utf-8' }) });
    });
  }
  var SID = 'asthmamap-mast-cell-graphml';   // a GraphML demo map still on the site (Copy of Glycolysis, the one before, was deleted forever there)
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
  var recs = function () { return page.evaluate(function () { return new Promise(function (res) { var q = indexedDB.open('atlas-edit-drafts'); q.onsuccess = function () { try { var g = q.result.transaction('mine').objectStore('mine').getAll(); g.onsuccess = function () { res(g.result); }; } catch (e) { res([]); } }; q.onerror = function () { res([]); }; }); }); };
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

  // 1. a reader's map, no token
  await load();
  await menu('#m2-list .m2-map >> nth=0', 'New SBGN-ML map'); await page.waitForTimeout(1500);
  var id1 = await hash();
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800);
  await menu('#m2-list .m2-map[data-id="' + id1 + '"]', 'Delete map');
  ok('1. deleted: out of the list, Deleted (1) closed', (await ids()).indexOf(id1) < 0 && (await head()) === 'Deleted (1) shut', await head());
  var r1 = (await recs()).filter(function (r) { return r.id === id1; })[0];
  ok('1. its record kept, in Deleted', r1 && r1.hidden && r1.deleted > 0);
  await openBin();
  ok('1. Deleted opened: the map in it', (await binned()).indexOf(id1) >= 0);
  await page.click('#m2-list .m2-binned[data-id="' + id1 + '"]'); await page.waitForTimeout(2000);
  ok('1. a deleted map shown has no Edit tab', !(await page.$('.m2-ri[data-win="edit"]:visible')));
  await page.click('#m2-list .m2-map:not(.m2-binned) >> nth=0'); await page.waitForTimeout(1000);
  await menu('#m2-list .m2-map:not(.m2-binned) >> nth=0', 'New SBGN-ML map'); await page.waitForTimeout(1500);
  var id1b = await hash();
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800);
  ok('1. its name free: the new map is Unnamed map', (await title(id1b)) === 'Unnamed map', await title(id1b));
  await openBin();
  await menu('#m2-list .m2-binned[data-id="' + id1 + '"]', 'Restore');
  ok('1. restored where its group has the name in its format by then: Unnamed map (1), as Finder; Deleted (0) stays', (await title(id1)) === 'Unnamed map (1)' && /^Deleted \(0\) /.test(await head()), (await title(id1)) + ' | ' + (await head()));
  await menu('#m2-list .m2-map[data-id="' + id1 + '"]', 'Delete map');
  await openBin();
  await menu('#m2-list .m2-binned[data-id="' + id1 + '"]', 'Delete forever');
  ok('1. deleted forever: its record gone, Deleted (0) stays', !(await recs()).some(function (r) { return r.id === id1; }) && /^Deleted \(0\) /.test(await head()), await head());

  // 2. a site map with a token
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); });
  await load('f001-glycolysis'); await list();
  await menu('#m2-list .m2-map[data-id="glycolysis-graphml"]', 'Rename map');   // the page's front matter, the same writer as Delete map's
  await page.keyboard.type('Glycolysis renamed'); await page.keyboard.press('Enter'); await page.waitForTimeout(2000);
  ok('2. Rename map on a site map: topic and title written', /^title: "Glycolysis renamed"$/m.test(files['maps/glycolysis-graphml.md']) && /^topic: "Glycolysis renamed"$/m.test(files['maps/glycolysis-graphml.md']), files['maps/glycolysis-graphml.md']);
  files['maps/glycolysis-graphml.md'] = '---\ntitle: "Glycolysis"\ntopic: "Glycolysis"\ngroup: "GraphML"\norder: 1\n---\n';
  await menu('#m2-list .m2-map[data-id="' + SID + '"]', 'Delete map');
  var md = files['maps/' + SID + '.md'];
  ok('2. its page has deleted:', /^deleted: "\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ"$/m.test(md) && /^---\n[\s\S]*\n---\nIts text\.\n$/.test(md), JSON.stringify(md));
  await openBin();
  ok('2. shown in Deleted at once, out of the list', (await binned()).indexOf(SID) >= 0 && (await ids()).indexOf(SID) < 0);
  built[SID] = md.match(/^deleted: "(.*)"$/m)[1];
  await load('f001-glycolysis'); await list(); await openBin();
  ok('2. the build listing it deleted: still in Deleted, nothing pending', (await binned()).indexOf(SID) >= 0 && !(await page.evaluate(function () { return localStorage.getItem('atlas-bin-pending'); })));
  await menu('#m2-list .m2-binned[data-id="' + SID + '"]', 'Restore');
  md = files['maps/' + SID + '.md'];
  ok('2. restored: the line dropped, the page as before (but its written: time)', md.replace(/^written: .*\n/m, '') === '---\ntitle: "Copy of Glycolysis"\ntopic: "Copy of Glycolysis"\ngroup: "Testing"\norder: 3\n---\nIts text.\n' && (await ids()).indexOf(SID) >= 0, JSON.stringify(md));
  delete built[SID];
  await menu('#m2-list .m2-map[data-id="' + SID + '"]', 'Delete map');
  await openBin();
  var c0 = commits;
  await menu('#m2-list .m2-binned[data-id="' + SID + '"]', 'Delete forever'); await page.waitForTimeout(1500);
  ok('2. deleted forever: its files gone in one commit', commits === c0 + 1 && files['maps/' + SID + '.md'] == null && files['maps/' + SID + '.graphml'] == null && (await binned()).indexOf(SID) < 0, Object.keys(files).join(' '));

  // 2b. three site maps deleted together, then Cmd+Z: all three back, no message (their pages written one after another)
  var three = ['glycolysis-graphml', 'glycogen-muscle-graphml', 'glycogen-liver-graphml'].filter(function (id) { return files['maps/' + id + '.md'] != null; });
  var alerts2 = []; page.on('dialog', function (d) { if (d.type() === 'alert') alerts2.push(d.message()); });
  await load(three[0]); await list();
  await page.click('#m2-list .m2-map[data-id="' + three[0] + '"]'); await page.waitForTimeout(500);
  for (var t3 = 1; t3 < three.length; t3++) { await page.click('#m2-list .m2-map[data-id="' + three[t3] + '"]', { modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] }); await page.waitForTimeout(200); }
  await page.click('#m2-list .m2-map[data-id="' + three[0] + '"]', { button: 'right' }); await page.waitForTimeout(300);
  await page.evaluate(function () { Array.prototype.filter.call(document.querySelectorAll('.m2-cx button'), function (x) { return /^Delete \d+ maps$/.test(x.textContent); })[0].click(); }); await page.waitForTimeout(4000);
  var del3 = three.filter(function (id) { return /^deleted:/m.test(files['maps/' + id + '.md']); }).length;
  await page.click('#m2-list .m2-map:not(.m2-binned) >> nth=0'); await page.waitForTimeout(800);
  refused = 0; refuseNext = true;   // the first restore refused once: read again and tried again, quietly
  await page.keyboard.press((process.platform === 'darwin' ? 'Meta' : 'Control') + '+z'); await page.waitForTimeout(6000);
  var back3 = three.filter(function (id) { return !/^deleted:/m.test(files['maps/' + id + '.md']); }).length;
  ok('2b. ' + three.length + ' site maps deleted together, Cmd+Z: all back, no message', three.length === 3 && del3 === 3 && back3 === 3 && refused >= 1 && !alerts2.length, del3 + ' deleted, ' + back3 + ' back, refused and tried again ' + refused + ', ' + alerts2.join(' | '));

  // 3. without a token a deleted site map is not listed
  built['glycolysis-graphml'] = built['glycolysis-sbgn'] = '2026-11-19T10:00:00Z';
  await page.evaluate(function () { localStorage.removeItem('atlas-edit-token'); });
  await load('f001-glycolysis'); await list();
  ok('3. no token: a deleted site map not listed, Deleted (0)', (await ids()).indexOf('glycolysis-graphml') < 0 && (await ids()).indexOf('glycolysis-sbgn') < 0 && /^Deleted \(0\) /.test(await head()), await head());
  delete built['glycolysis-graphml']; delete built['glycolysis-sbgn'];

  // 3b. the twin restored through its GraphML map
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); });
  files['maps/glycolysis-graphml.md'] = '---\ntitle: "Glycolysis"\ntopic: "Glycolysis"\ngroup: "GraphML"\norder: 1\ndeleted: "2026-11-19T10:00:00Z"\n---\n';
  built['glycolysis-graphml'] = built['glycolysis-sbgn'] = '2026-11-19T10:00:00Z';
  await load('f001-glycolysis'); await list(); await openBin();
  var alerts3 = []; page.on('dialog', function (d) { if (d.type() === 'alert') alerts3.push(d.message()); });
  await menu('#m2-list .m2-binned[data-id="glycolysis-sbgn"]', 'Restore');
  ok('3b. Restore on the twin: no message, the GraphML map\'s page restored under its own name', !alerts3.length && !/deleted:/.test(files['maps/glycolysis-graphml.md']) && /topic: "Glycolysis"\n/.test(files['maps/glycolysis-graphml.md']), alerts3.join(' | ') + ' ' + JSON.stringify(files['maps/glycolysis-graphml.md']));
  ok('3b. both out of Deleted at once', (await ids()).indexOf('glycolysis-graphml') >= 0 && (await ids()).indexOf('glycolysis-sbgn') >= 0);
  delete built['glycolysis-graphml']; delete built['glycolysis-sbgn'];
  files['maps/glycolysis-graphml.md'] = '---\ntitle: "Glycolysis"\ntopic: "Glycolysis"\ngroup: "GraphML"\norder: 1\n---\n';

  // 4. an older version's hidden map moved into Deleted
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); localStorage.setItem('atlas-hidden-maps', '["glycolysis-graphml"]'); });
  await load('f001-glycolysis'); await page.waitForTimeout(4000);
  ok('4. the hidden map marked deleted on its page, the old key gone', /^deleted: /m.test(files['maps/glycolysis-graphml.md']) && !(await page.evaluate(function () { return localStorage.getItem('atlas-hidden-maps'); })), files['maps/glycolysis-graphml.md']);

  // 5. Cmd+Delete (Ctrl+Delete elsewhere); Delete alone keeps the map, as in Finder
  var mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.evaluate(function () { localStorage.removeItem('atlas-edit-token'); localStorage.removeItem('atlas-bin-pending'); });
  await load('f001-glycolysis'); await list();
  await menu('#m2-list .m2-map >> nth=0', 'New SBGN-ML map'); await page.waitForTimeout(1500);
  var k1 = await hash();
  await page.keyboard.press(mod + '+Delete'); await page.waitForTimeout(800);
  ok('5. ' + mod + '+Delete while editing: the map kept', (await ids()).indexOf(k1) >= 0 || !(await binned()).length);
  await page.keyboard.press('Escape'); await page.click('.m2-ri[data-win="edit"]').catch(function () {}); await page.waitForTimeout(1500);
  await page.click('.m2-ri[data-win="list"]').catch(function () {}); await page.waitForTimeout(800);
  var editing = await page.evaluate(function () { return !!document.querySelector('.m2-editing'); });
  if (editing) { await page.keyboard.press('e'); await page.waitForTimeout(1500); await list(); }
  await page.click('#m2-list .m2-map[data-id="' + k1 + '"]'); await page.waitForTimeout(1500);
  var before = await ids(), at = before.indexOf(k1);
  await page.keyboard.press('Delete'); await page.waitForTimeout(800);
  await page.keyboard.press('Backspace'); await page.waitForTimeout(800);
  ok('5. Delete or Backspace alone on the map shown: kept, as in Finder', (await ids()).indexOf(k1) >= 0 && (await hash()) === k1, await hash());
  await page.click('#m2-list .m2-map[data-id="' + k1 + '"]', { button: 'right' }); await page.waitForTimeout(300);
  var dk = await page.$eval('.m2-cx button:text-is("Delete map")', function (x) { return x.dataset.key || ''; }).catch(function () { return ''; });
  ok('5. the menu\'s Delete map shows its key', dk === '\u2318\u232B' || dk === 'Ctrl+Del', JSON.stringify(dk));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press(mod + '+Backspace'); await page.waitForTimeout(1500);
  ok('5. ' + mod + '+Backspace on the map shown: in Deleted, out of the list', (await ids()).indexOf(k1) < 0 && /Deleted \(\d+\)/.test(await head()), await head());
  ok('5. the next map shown', (await hash()) === before[at + 1] || (await hash()) === before[at - 1], await hash());
  var k2 = await hash();
  await page.keyboard.press(mod + '+Delete'); await page.waitForTimeout(1500);
  ok('5. ' + mod + '+Delete on a site map without a token: kept', (await ids()).indexOf(k2) >= 0 && (await hash()) === k2);
  // 6. the list kept where it is
  await page.click('#m2-list .m2-map:not(.m2-binned) >> nth=0'); await page.waitForTimeout(1500);
  var still = async function (sel) {
    var top = await page.$eval('#m2-list', function (b) { b.scrollTop = b.scrollHeight; return b.scrollTop; });
    await page.waitForTimeout(300);
    await page.click(sel); await page.waitForTimeout(800);
    return [top, await page.$eval('#m2-list', function (b) { return b.scrollTop; })];
  };
  var s6 = await still('#m2-list .m2-bin');
  ok('6. Deleted opened or closed at the list\'s end: the list not moved', s6[0] > 200 && Math.abs(s6[1] - s6[0]) < 2, s6.join(' -> '));
  var s7 = await still('#m2-list .m2-group:not(.m2-bin) >> nth=-1');
  ok('6. the last group opened or closed: the list not moved (or only as far as a shorter list must)', s7[0] > 200 && (Math.abs(s7[1] - s7[0]) < 2 || await page.$eval('#m2-list', function (b) { return Math.abs(b.scrollTop - (b.scrollHeight - b.clientHeight)) < 2; })), s7.join(' -> '));
  await openBin();
  await menu('#m2-list .m2-binned[data-id="' + k1 + '"]', 'Delete forever');

  ok('no script errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
