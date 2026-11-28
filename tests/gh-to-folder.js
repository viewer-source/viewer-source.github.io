// The switch from GitHub to a folder and back (own.js moveOut, moveBack; core.js askOff): with a token, Disconnect offers
// Copy to a folder, then disconnect; the site's maps are copied into the folder (read back), the token removed only
// then, each map shown once (its copy in the site's place), GitHub unchanged. A copy changed in the folder (as yEd or
// CellDesigner would) is read again; connected again, only that one is saved over its file on GitHub, the unchanged ones
// give their place back to the site's maps, and no map is listed twice at any step. A copy stopped halfway (GitHub
// refusing a file) leaves the token and the list as they were. GitHub is played by this script (the site's published
// files as the data repository), the folder by the browser's private file system. Four maps of the demo: CellDesigner,
// GraphML, SBGN-ML.
//   node tests/gh-to-folder.js [base address] [viewer folder: its editor served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), crypto = require('crypto');
var base = process.argv[2] || 'https://viewer-source.github.io/', local = process.argv[3], bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
var gitSha = function (t) { var b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex'); };
var KEEP = ['colour-test', 'glycolysis-graphml', 'colour-glycolysis-sbgn', 'tag-celldesigner'];
(async function () {
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [];
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
  }
  await page.addInitScript(function () { window.showDirectoryPicker = function () { return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps', { create: true }); }); }; });
  page.on('pageerror', function (e) { errs.push(e.message); });
  var files = {}, puts = [], refuse = null, refusePut = null, site = null, built = {};
  await page.route('**/index.json*', async function (route) {
    var res = await route.fetch(), list = JSON.parse(await res.text());
    list = list.filter(function (m) { return KEEP.indexOf(m.id) >= 0; }).map(function (m) { return built[m.id] ? Object.assign({}, m, { src: built[m.id], v: 'b' + built[m.id].slice(0, 6) }) : m; });
    site = list;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) });
  });
  var fileOf = async function (p) {   // the data repository's file: the site's published one
    if (files[p] !== undefined) return files[p];
    var m = /^maps\/([^/]+)$/.exec(p);
    if (!m) return (files[p] = null);
    var pg = /^(.+)\.md$/.exec(m[1]), sm = pg && (site || []).filter(function (x) { return x.id === pg[1]; })[0];
    if (pg) return (files[p] = sm ? '---\ntitle: "' + sm.title + '"\ntopic: "' + sm.topic + '"\ngroup: "' + sm.group + '"\n---\n' : null);
    var r = await ctx.request.get(new URL('/downloads/' + m[1], base).href);
    files[p] = r.ok() ? await r.text() : null;
    return files[p];
  };
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '', meth = r.method();
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    if (rest === '') return json(200, { permissions: { push: true } });
    var c = rest.match(/^\/contents\/(.+)$/);
    if (c && meth === 'PUT') {
      var p = decodeURIComponent(c[1]), d = JSON.parse(r.postData()), now = await fileOf(p);
      puts.push(p);
      if (refusePut && p === refusePut) return json(500, { message: 'test: refused' });
      if (now != null && d.sha !== gitSha(now)) return json(409, { message: 'test: sha does not match' });
      files[p] = Buffer.from(d.content, 'base64').toString('utf8');
      return json(200, { content: { sha: gitSha(files[p]) } });
    }
    if (c) {
      var p2 = decodeURIComponent(c[1]);
      if (refuse && p2 === refuse) return json(500, { message: 'test: refused' });
      var t = await fileOf(p2);
      if (t == null) return json(404, { message: 'Not Found' });
      if (/raw/.test(r.headers().accept || '')) return route.fulfill({ status: 200, contentType: 'text/plain', body: t });
      return json(200, { sha: gitSha(t), content: Buffer.from(t).toString('base64') });
    }
    return json(404, { message: 'Not Found' });
  });
  var ids = function () { return page.$$eval('#m2-list .m2-map', function (l) { return l.map(function (x) { return x.dataset.id; }); }); };
  var titles = function () { return page.$$eval('#m2-list .m2-map', function (l) { return l.map(function (x) { return x.textContent.trim(); }); }); };
  var twice = function (a) { return a.filter(function (x, i) { return a.indexOf(x) !== i; }); };
  var recs = function () { return page.evaluate(function () { return new Promise(function (res) { var q = indexedDB.open('atlas-edit-drafts'); q.onsuccess = function () { try { var g = q.result.transaction('mine').objectStore('mine').getAll(); g.onsuccess = function () { res(g.result); }; } catch (e) { res([]); } }; q.onerror = function () { res([]); }; }); }); };
  var inFolder = function () { return page.evaluate(async function () { var d = await (await navigator.storage.getDirectory()).getDirectoryHandle('maps', { create: true }), o = []; for await (var h of d.values()) if (h.kind === 'file') o.push(h.name); return o.sort(); }); };
  var token = function () { return page.evaluate(function () { return localStorage.getItem('atlas-edit-token'); }); };
  var open = async function () { await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(3000); };
  var list = async function () { if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]'); await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(500); };
  // connected again as a person would: Switch where maps are saved, from the folder, Work on GitHub, the token, Connect
  var byWindow = async function (tag) {
    await list(); await page.click('#m2-list .m2-map'); await page.waitForTimeout(1500);   // a map of the list open, as a person would
    await page.click('.m2-ri[data-win="edit"]'); await page.waitForSelector('#m2-ed-gh-off', { state: 'visible', timeout: 30000 }); await page.click('#m2-ed-gh-off');
    await page.waitForSelector('.m2-ask', { timeout: 10000 });
    var w = await page.$eval('.m2-ask-pick', function (e) { return { now: e.querySelector('.m2-ask-now').textContent, cards: Array.prototype.map.call(e.querySelectorAll('.m2-ask-opt b'), function (b) { return b.textContent; }) }; });
    ok(tag + ' from the folder: Now Folder, GitHub, then this browser', /^Now: Folder \(/.test(w.now) && w.cards.join('|') === 'Work on GitHub|Work in this browser', JSON.stringify(w));
    await page.click('.m2-ask-gh'); await page.fill('.m2-ask-tin', 'test-token'); await page.keyboard.press('Enter');
    await page.waitForSelector('.m2-ask-switch', { state: 'detached', timeout: 15000 });
    ok(tag + ' the token kept by Connect', (await token()) === 'test-token');
  };
  var askOff = async function () { await page.click('.m2-ri[data-win="edit"]'); await page.waitForSelector('#m2-ed-gh-off', { state: 'visible', timeout: 30000 }); await page.click('#m2-ed-gh-off'); await page.waitForSelector('.m2-ask', { timeout: 10000 }); };

  await page.goto(base + '#colour-test', { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); });
  await open(); await list();
  var before = await ids();
  ok('0. connected: the four maps, each once', before.length === 4 && !twice(before).length, before.join(' '));

  // a copy refused halfway: nothing changes
  refuse = 'maps/tag-celldesigner.xml';
  await askOff();
  ok('1. Disconnect offers the copy, Cancel focused', !!(await page.$('.m2-ask-copy')) && (await page.evaluate(function () { return document.activeElement.className; })) === 'm2-ask-no');
  await page.click('.m2-ask-copy');
  await page.waitForSelector('.m2-ask-say.m2-ask-bad', { timeout: 60000 }).catch(function () {});
  var said = await page.$eval('.m2-ask-say', function (e) { return e.textContent; }).catch(function () { return ''; });
  ok('1. refused halfway: said in the window, still connected', /Not copied, still connected/.test(said) && (await token()) === 'test-token', said);
  await page.keyboard.press('Escape'); await page.waitForTimeout(800);
  await list();
  var mid = await ids();
  ok('1. the list as before, no copies left in it', JSON.stringify(mid) === JSON.stringify(before) && !(await recs()).some(function (r) { return r.from; }), mid.join(' '));

  // the copy
  refuse = null; puts = [];
  await askOff(); await page.click('.m2-ask-copy');
  await page.waitForSelector('.m2-ask-done:not([hidden])', { timeout: 120000 });
  var doneSaid = await page.$eval('.m2-ask-done', function (e) { return e.textContent; });
  ok('2. the window says where it now works, OK closes it', /Working from .*Every change is saved in this folder/.test(doneSaid), doneSaid);
  await page.click('.m2-ask-ok'); await page.waitForSelector('.m2-ask', { state: 'detached', timeout: 5000 });
  await page.waitForTimeout(2500);
  var rs = (await recs()).filter(function (r) { return r.from; }), fl = await inFolder();
  ok('2. copied: four copies, their files in the folder (the one stopped before reused, not doubled)', rs.length === 4 && fl.filter(function (n) { return /\.(xml|graphml|sbgn)$/.test(n); }).length === 4, fl.join(' '));
  ok('2. each copy\'s file as GitHub has it', rs.every(function (r) { return r.text === files[r.from.path] && r.from.sha === gitSha(files[r.from.path]); }), JSON.stringify(rs.map(function (r) { return [r.from.path, r.text === files[r.from.path], r.from.sha === gitSha(files[r.from.path] || ''), (r.text || '').length, (files[r.from.path] || '').length]; })));
  ok('2. token removed only after, GitHub unchanged', (await token()) === null && puts.length === 0, String(puts));
  await list();
  var after = await ids(), tt = await titles();
  ok('2. each map listed once, from the folder', after.length === 4 && after.every(function (x) { return /^mine-/.test(x); }) && !twice(tt).length, after.join(' ') + ' | ' + tt.join(' / '));
  var red = await page.$eval('#m2-ed-status', function (s) { return s.textContent; }).catch(function () { return ''; });
  ok('2. said: copied, GitHub unchanged', /4 maps copied there/.test(red), red);

  // a reload: still once each, read from the folder; a file changed there as another program would
  await open(); await list();
  after = await ids();
  ok('3. after a reload: still each map once', after.length === 4 && after.every(function (x) { return /^mine-/.test(x); }), after.join(' '));
  var changed = rs.filter(function (r) { return r.from.site === 'colour-test'; })[0];
  await page.evaluate(async function (name) {
    var d = await (await navigator.storage.getDirectory()).getDirectoryHandle('maps'), h = await d.getFileHandle(name), t = await (await h.getFile()).text();
    var w = await h.createWritable(); await w.write(t.replace('</sbml>', '<!-- changed in the folder -->\n</sbml>')); await w.close();
  }, changed.file);
  await open(); await list();
  var c2 = (await recs()).filter(function (r) { return r.id === changed.id; })[0];
  ok('3. the file changed in the folder read again into its copy', c2 && /changed in the folder/.test(c2.text));
  after = await ids();
  ok('3. still each map once', after.length === 4 && !twice(after).length, after.join(' '));

  // while in the folder: one copy renamed, one deleted (as the list's menu would leave their records)
  var tagC = rs.filter(function (r) { return r.from.site === 'tag-celldesigner'; })[0], glyC = rs.filter(function (r) { return r.from.site === 'glycolysis-graphml'; })[0];
  await page.evaluate(function (a) { return new Promise(function (res) { var q = indexedDB.open('atlas-edit-drafts'); q.onsuccess = function () { var st = q.result.transaction('mine', 'readwrite').objectStore('mine'), g1 = st.get(a[0]); g1.onsuccess = function () { var r = g1.result; r.title = 'Renamed in the folder'; st.put(r, r.id); var g2 = st.get(a[1]); g2.onsuccess = function () { var r2 = g2.result; r2.hidden = true; r2.deleted = Date.now(); st.put(r2, r2.id); }; }; st.transaction.oncomplete = function () { res(); }; }; }); }, [tagC.id, glyC.id]);

  // connected again
  puts = [];
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(3000); await byWindow('4.'); await page.waitForTimeout(3000); await list();
  var mapPuts = puts.filter(function (p) { return !/\.md$/.test(p); });
  ok('4. all back cleanly: no window', !(await page.$('.m2-back')));
  ok('4. connected again: only the changed map saved to GitHub', mapPuts.length === 1 && mapPuts[0] === changed.from.path && /changed in the folder/.test(files[changed.from.path]), String(puts));
  ok('4. the renamed copy: its page renamed on GitHub', /Renamed in the folder/.test(files['maps/tag-celldesigner.md'] || ''), files['maps/tag-celldesigner.md']);
  ok('4. the deleted copy: its site map in Deleted on GitHub', /deleted:/.test(files['maps/glycolysis-graphml.md'] || ''), files['maps/glycolysis-graphml.md']);
  rs = await recs();
  ok('4. no copy waiting any more', !rs.some(function (r) { return r.from; }), JSON.stringify(rs.map(function (r) { return [r.id, r.site]; })));
  after = await ids(); tt = await titles();
  ok('4. each map listed once (the changed one from this browser until the build has its save), the deleted one gone', after.length === 3 && !twice(tt).length && after.filter(function (x) { return /^mine-/.test(x); }).length === 1 && after.indexOf('colour-test') < 0 && after.indexOf('glycolysis-graphml') < 0, after.join(' ') + ' | ' + tt.join(' / '));
  ok('4. the renamed one under its new name', tt.some(function (x) { return /Renamed in the folder/.test(x); }) && !tt.some(function (x) { return /Triacylglycerol/.test(x); }), tt.join(' / '));
  // the site's build of that save: its map takes the copy's place
  built[changed.from.site] = gitSha(files[changed.from.path]); built['tag-celldesigner'] = gitSha(files['maps/tag-celldesigner.xml']);
  await page.evaluate(function () { document.dispatchEvent(new Event('visibilitychange')); }); await page.waitForTimeout(3000);
  after = await ids();
  ok('5. the builds of the saves: the site\'s maps in the copies\' places, each once', !twice(after).length && !after.some(function (x) { return /^mine-/.test(x); }) && after.indexOf('colour-test') >= 0 && after.indexOf('tag-celldesigner') >= 0 && !(await recs()).length, after.join(' '));
  // a second time in the folder: one copy changed both there and on GitHub (both kept), one GitHub refuses (not back yet)
  await askOff(); await page.click('.m2-ask-copy');
  await page.waitForSelector('.m2-ask-done:not([hidden])', { timeout: 120000 }); await page.click('.m2-ask-ok'); await page.waitForTimeout(2500);
  var rs2 = (await recs()).filter(function (r) { return r.from; });
  var bothC = rs2.filter(function (r) { return r.from.site === 'colour-glycolysis-sbgn'; })[0], failC = rs2.filter(function (r) { return r.from.site === 'colour-test'; })[0];
  ok('6. copied again', !!bothC && !!failC, JSON.stringify(rs2.map(function (r) { return r.from.site; })));
  if (bothC && failC) {
    await page.evaluate(async function (a) {
      var d = await (await navigator.storage.getDirectory()).getDirectoryHandle('maps');
      for (var name of a) { var h = await d.getFileHandle(name), t = await (await h.getFile()).text(), w = await h.createWritable(); await w.write(t + '\n<!-- changed in the folder again -->\n'); await w.close(); }
    }, [bothC.file, failC.file]);
    await open();
    files[bothC.from.path] = files[bothC.from.path] + '\n<!-- changed on GitHub meanwhile -->\n';
    refusePut = failC.from.path;
    await byWindow('7.');
    await page.waitForSelector('.m2-back', { timeout: 30000 }).catch(function () {});
    var said2 = await page.$eval('.m2-back', function (e) { return e.textContent; }).catch(function () { return ''; });
    ok('7. connected again: a window says it', /Connected to GitHub again/.test(said2), said2);
    ok('7. names the map kept twice', /both versions are kept/.test(said2) && said2.indexOf(bothC.title) >= 0, said2);
    ok('7. names the map not back yet', /Not back on GitHub yet/.test(said2) && said2.indexOf(failC.title) >= 0, said2);
    ok('7. OK focused', (await page.evaluate(function () { return document.activeElement.textContent; })) === 'OK');
    await page.keyboard.press('Escape');
    ok('7. Esc closes it', !(await page.$('.m2-back')));
    await list(); var tt7 = await titles();
    ok('7. the map changed in both places listed twice, as the window says', tt7.filter(function (x) { return x.indexOf(bothC.title) === 0; }).length === 2, tt7.join(' / '));
    refusePut = null;
    // 8. from GitHub to this browser (the folder still remembered: now Folder), then to this browser alone
    var cards = function () { return page.$eval('.m2-ask-pick', function (e) { return e.querySelector('.m2-ask-now').textContent + ' | ' + Array.prototype.map.call(e.querySelectorAll('.m2-ask-opt b'), function (b) { return b.textContent; }).join('|'); }); };
    await askOff(); await page.click('.m2-ask-yes'); await page.waitForTimeout(1000);
    ok('8. Work in this browser from GitHub: the token removed', (await token()) === null);
    await page.click('#m2-ed-gh-off'); await page.waitForSelector('.m2-ask', { timeout: 10000 });
    var c8 = await cards();
    ok('8. now the folder', /^Now: Folder \(.*\) \| Work on GitHub\|Work in this browser$/.test(c8), c8);
    await page.click('.m2-ask-yes'); await page.waitForTimeout(1000);
    ok('8. Work in this browser from the folder: the folder let go', (await page.evaluate(function () { return localStorage.getItem('atlas-edit-folder'); })) === null);
    await page.click('#m2-ed-gh-off'); await page.waitForSelector('.m2-ask', { timeout: 10000 });
    var c8b = await cards();
    ok('8. now this browser: the folder recommended, then GitHub', c8b === 'Now: This browser | Work from a folder (recommended)|Work on GitHub', c8b);
    await page.keyboard.press('Escape');
    ok('8. Esc closes it', !(await page.$('.m2-ask')));
  }
  ok('no script errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.log('WRONG ' + e.message); process.exit(1); });
