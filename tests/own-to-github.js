// A reader's own maps with a GitHub token: GitHub is where they are kept, never a folder or this browser alone. GitHub
// is played by this script (page.route on api.github.com, a repository held in memory, blob shas as git makes them).
//   1. A map made without a token stays in this browser; once a token is in, the page opening sends it to GitHub.
//   2. New SBGN-ML map with a token: its file and page committed at once, Choose a folder not offered, a node made is
//      saved to that file, the record knows the sha saved; after a reload, editing goes on saving there (no refusal).
//   3. The site's build listing the map: kept from this browser while its src is of an older save or while it is
//      edited, the site's entry not shown twice; once the build is of the last save, the site's map takes its place.
//   4. Sending refused: said in red in the Edit window; the next change sends it.
//   5. New CellDesigner map with a token: committed at once, no folder offered, a protein placed saved to its file;
//      5b. Make a copy of it: the copy committed at once.
//   6. Disconnected while editing: the moves kept in this browser; the page opened connected again sends them.
//   node tests/own-to-github.js [base address] [viewer folder: its editor served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), crypto = require('crypto');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3];
var gitSha = function (t) { var b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex'); };
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {   // the editor as Jekyll builds it (editor.js with its sources put in), from a working tree
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  // the data repository in memory: files (path -> text), blobs, a tree waiting for its commit
  var files = {}, blobs = {}, trees = {}, commits = 0, puts = [], refuseBlobs = false, listed = null;
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '', meth = r.method();
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    if (rest === '') return json(200, { permissions: { push: true } });
    if (rest === '/contents/maps') return json(200, Object.keys(files).filter(function (p) { return /^maps\/[^/]+$/.test(p); }).map(function (p) { return { name: p.slice(5), type: 'file' }; }));
    if (rest === '/git/blobs' && meth === 'POST') {
      if (refuseBlobs) return json(500, { message: 'test: refused' });
      var t = Buffer.from(JSON.parse(r.postData()).content, 'base64').toString('utf8'), s = gitSha(t);
      blobs[s] = t; return json(201, { sha: s });
    }
    if (rest === '/git/ref/heads/main') return json(200, { object: { sha: 'c' + commits } });
    if (/^\/git\/commits\/c\d+$/.test(rest)) return json(200, { tree: { sha: 't' + commits } });
    if (rest === '/git/trees' && meth === 'POST') { if (refuseBlobs) return json(500, { message: 'test: refused' }); var id = 'n' + Object.keys(trees).length; trees[id] = JSON.parse(r.postData()).tree; return json(201, { sha: id }); }
    if (rest === '/git/commits' && meth === 'POST') { var d0 = JSON.parse(r.postData()); trees['c:' + (commits + 1)] = trees[d0.tree]; return json(201, { sha: 'c' + (commits + 1) }); }
    if (rest === '/git/refs/heads/main' && meth === 'PATCH') {
      commits++; (trees['c:' + commits] || []).forEach(function (e) { files[e.path] = e.content != null ? e.content : blobs[e.sha]; });
      return json(200, {});
    }
    var c = rest.match(/^\/contents\/(.+)$/);
    if (c && meth === 'PUT') {
      var p = decodeURIComponent(c[1]), d = JSON.parse(r.postData());
      puts.push(p);
      if (files[p] != null && d.sha !== gitSha(files[p])) return json(409, { message: 'test: sha does not match' });
      files[p] = Buffer.from(d.content, 'base64').toString('utf8');
      return json(200, { content: { sha: gitSha(files[p]) } });
    }
    if (c) {
      var p2 = decodeURIComponent(c[1]);
      if (files[p2] == null) return json(404, { message: 'Not Found' });
      if (/raw/.test(r.headers().accept || '')) return route.fulfill({ status: 200, contentType: 'text/plain', body: files[p2] });
      return json(200, { sha: gitSha(files[p2]), content: Buffer.from(files[p2]).toString('base64') });
    }
    return json(404, { message: 'Not Found' });
  });
  // the site's list: the demo's, with the map the build would add once listed is set (its src: the file's sha drawn)
  await page.route('**/index.json*', async function (route) {
    var res = await route.fetch(), list = JSON.parse(await res.text());
    if (listed) list.unshift({ id: listed.id, title: 'Unnamed map', topic: 'Unnamed map', group: '', kind: 'map', draft: false, tag: '', tab: '', page: '',
      image: '/downloads/colour-test.svg', width: 1065, height: 738, scale: 1, annotation: '/atlas-data/colour-test.json', v: 'test' + listed.src.slice(0, 6), src: listed.src,
      legend: 'sbgn', colours: true, sbgn: null, editPath: 'maps/' + listed.id + '.sbgn', editBase: null, downloads: [] });
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) });
  });
  var status = function () { return page.$eval('#m2-ed-status', function (s) { return s.textContent; }).catch(function () { return ''; }); };
  var recs = function () { return page.evaluate(function () { return new Promise(function (res) { var q = indexedDB.open('atlas-edit-drafts', 3); q.onsuccess = function () { try { var g = q.result.transaction('mine').objectStore('mine').getAll(); g.onsuccess = function () { res(g.result); }; } catch (e) { res([]); } }; q.onerror = function () { res([]); }; }); }); };
  var listMenu = async function (item) {
    if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]');
    await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 });
    await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
    await page.click('.m2-cx button:has-text("' + item + '")'); await page.waitForTimeout(2500);
  };
  var palette = async function () { await page.waitForSelector('#m2-editwin button[data-make="macromolecule"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1000); };
  var make = async function (x, y) { await page.click('#m2-editwin button[data-make="macromolecule"]'); await page.mouse.click(x, y); await page.waitForTimeout(900); await page.keyboard.press('Escape'); };
  var edit = async function () { if (!(await page.$('#m2-editwin button[data-make="macromolecule"]:visible'))) await page.click('.m2-ri[data-win="edit"]'); await palette(); };
  var refresh = async function () { await page.evaluate(function () { document.dispatchEvent(new Event('visibilitychange')); }); await page.waitForTimeout(2500); };
  var edit5 = async function () { if (!(await page.$('#m2-editwin button[data-make="cd:PROTEIN"]:visible'))) await page.click('.m2-ri[data-win="edit"]'); await page.waitForSelector('#m2-editwin button[data-make="cd:PROTEIN"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1000); };
  var hash = function () { return page.evaluate(function () { return location.hash.slice(1); }); };

  // 1. made without a token, sent once a token is in
  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(1500);
  await listMenu('New SBGN-ML map'); await palette();
  ok('1. no token: the new map kept in this browser, nothing on GitHub', commits === 0 && (await recs()).length === 1 && !(await recs())[0].site);
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); });
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(4000);
  var r1 = (await recs())[0];
  ok('1. with a token the page sends it: its file and page committed', files['maps/unnamed-map.sbgn'] != null && files['maps/unnamed-map.md'] != null && r1 && r1.site === 'unnamed-map' && r1.sha === gitSha(files['maps/unnamed-map.sbgn']), JSON.stringify(Object.keys(files)));

  // 2. New SBGN-ML map with a token
  var c0 = commits;
  await listMenu('New SBGN-ML map'); await palette();
  var id2 = await hash(), r2 = (await recs()).filter(function (r) { return r.id === id2; })[0];
  ok('2. New map with a token: committed at once', commits === c0 + 1 && r2 && r2.site === 'unnamed-map-2' && files['maps/unnamed-map-2.sbgn'] != null, id2 + ' ' + JSON.stringify(r2 && r2.site));
  ok('2. Choose a folder not offered', !(await page.$('#m2-ed-l-folder:visible')) && !(await page.$('#m2-ed-local:visible')));
  await make(800, 400); await page.waitForTimeout(5000);
  var f2 = files['maps/unnamed-map-2.sbgn'] || '';
  ok('2. a node made is saved to its file on GitHub', /class="macromolecule"/.test(f2) && puts.indexOf('maps/unnamed-map-2.sbgn') >= 0, puts.join(' ') + ' | ' + (await status()));
  r2 = (await recs()).filter(function (r) { return r.id === id2; })[0];
  ok('2. the record knows the save (sha, text)', r2 && r2.sha === gitSha(f2) && r2.saved === f2 && r2.text === f2);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(2500);
  await edit();
  ok('2. after a reload it opens for editing (no refusal)', !/Cannot edit/.test(await status()), await status());
  var n0 = puts.length;
  await make(800, 600); await page.waitForTimeout(5000);
  var f2b = files['maps/unnamed-map-2.sbgn'] || '';
  ok('2. and goes on saving there', puts.length > n0 && (f2b.match(/class="macromolecule"/g) || []).length === 2 && !/Not saved/.test(await status()), (await status()));

  // 3. the build lists it
  listed = { id: 'unnamed-map-2', src: gitSha(f2) };   // a build of the earlier save
  await refresh();
  var names = await page.$$eval('#m2-list .m2-map', function (l) { return l.map(function (x) { return x.dataset.id; }); });
  ok('3. a build of an older save: still the reader\'s, the site\'s entry not shown', names.indexOf(id2) >= 0 && names.indexOf('unnamed-map-2') < 0, names.slice(0, 4).join(' '));
  listed = { id: 'unnamed-map-2', src: gitSha(f2b) };   // the build of the last save, while it is edited
  await refresh();
  names = await page.$$eval('#m2-list .m2-map', function (l) { return l.map(function (x) { return x.dataset.id; }); });
  ok('3. while edited: still the reader\'s', names.indexOf(id2) >= 0 && names.indexOf('unnamed-map-2') < 0, names.slice(0, 4).join(' '));
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(1500);
  await refresh(); await page.waitForTimeout(1500);
  names = await page.$$eval('#m2-list .m2-map', function (l) { return l.map(function (x) { return x.dataset.id; }); });
  ok('3. editing left, the build of the last save: the site\'s map in its place, shown', names.indexOf(id2) < 0 && names.indexOf('unnamed-map-2') >= 0 && (await hash()) === 'unnamed-map-2', (await hash()) + ' | ' + names.slice(0, 4).join(' '));

  // 4. sending refused, then sent after the next change
  refuseBlobs = true; c0 = commits;
  await listMenu('New SBGN-ML map'); await palette(); await page.waitForTimeout(1000);
  ok('4. sending refused: said in red', /Not on GitHub/.test(await status()) && commits === c0, await status());
  refuseBlobs = false;
  await make(800, 400); await page.waitForTimeout(6000);
  var id4 = await hash(), r4 = (await recs()).filter(function (r) { return r.id === id4; })[0];
  ok('4. the next change sends it, with the node', r4 && r4.site && /class="macromolecule"/.test(files[r4.path] || ''), JSON.stringify(r4 && [r4.site, r4.path]) + ' | ' + (await status()));

  // 5. New CellDesigner map with a token
  c0 = commits;
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800);
  await listMenu('New CellDesigner map'); await page.waitForTimeout(2000);
  var id5 = await hash(), r5 = (await recs()).filter(function (r) { return r.id === id5; })[0];
  ok('5. New CellDesigner map with a token: committed at once', commits === c0 + 1 && r5 && /\.xml$/.test(r5.path || '') && /celldesigner/.test(files[r5.path] || ''), JSON.stringify(r5 && r5.path));

  await edit5();
  ok('5. Choose a folder not offered on it either', !(await page.$('#m2-ed-l-folder:visible')) && !(await page.$('#m2-ed-local:visible')));
  var n5 = puts.length, nc5 = commits;
  await page.click('#m2-editwin button[data-make="cd:PROTEIN"]'); await page.mouse.click(800, 400); await page.waitForTimeout(900); await page.keyboard.press('Escape'); await page.waitForTimeout(5000);
  r5 = (await recs()).filter(function (r) { return r.id === id5; })[0];
  ok('5. a protein placed is saved to its file on GitHub', (puts.length > n5 || commits > nc5) && /class>PROTEIN<|"PROTEIN"/.test(files[r5.path] || '') && r5.sha === gitSha(files[r5.path]), puts.slice(n5).join(' ') + ' | ' + (await status()));
  // 5b. Make a copy of it with a token: the copy committed at once
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800);
  c0 = commits;
  await page.click('#m2-list .m2-map[data-id="' + id5 + '"]', { button: 'right' }); await page.waitForTimeout(300);
  await page.click('.m2-cx button:text-is("Make a copy")'); await page.waitForTimeout(3000);
  var id5c = await hash(), r5c = (await recs()).filter(function (r) { return r.id === id5c; })[0];
  ok('5b. Make a copy with a token: the copy committed at once, as the original is now', id5c !== id5 && commits > c0 && r5c && r5c.site && /\.xml$/.test(r5c.path || '') && /PROTEIN/.test(files[r5c.path] || ''), id5c + ' ' + JSON.stringify(r5c && [r5c.site, r5c.path]));

  // 6. disconnected while editing: the moves kept in this browser, sent when the page opens connected again
  await page.goto(base + '#' + id4, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(2500);
  await edit();
  await page.click('#m2-ed-gh-off'); await page.waitForTimeout(500);
  await make(1000, 500); await page.waitForTimeout(3000);
  r4 = (await recs()).filter(function (r) { return r.id === id4; })[0];
  var count = function (t) { return ((t || '').match(/class="macromolecule"/g) || []).length; };
  ok('6. disconnected: the move kept in this browser, not on GitHub', r4 && count(r4.text) === 2 && count(files[r4.path]) === 1, r4 && count(r4.text) + ' ' + count(files[r4.path]));
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800);
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); });
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(5000);
  r4 = (await recs()).filter(function (r) { return r.id === id4; })[0];
  ok('6. connected again: sent to GitHub, the record knows it', count(files[r4.path]) === 2 && r4.saved === r4.text && r4.sha === gitSha(files[r4.path]), count(files[r4.path]) + ' | ' + (await status()));

  ok('no script errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
