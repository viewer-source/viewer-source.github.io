// Add map from file with several files in one pick (no token: the maps kept in this browser).
//   1. The picker takes several files; two maps and one broken file picked together: both maps in the list, in the
//      order picked, the last one shown.
//   2. The broken file named in one message after the others are added (not one message per file).
//   3. With a token: three maps in one commit (each file and its page in the tree), the records knowing their sha.
//   4. A tree GitHub refuses as too large: sent in halves, every map still added.
//   5. Three files of one name, the second half refused: the first half kept with names and ids of their own, the
//      refused one named in the message.
//   node tests/add-files.js [base address] [--local]
// --local: the editor of the working tree routed into the live page.
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), crypto = require('crypto');
var gitSha = function (t) { var b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex'); };
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/styles/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..'), checks = path.join(here, '..', 'notes', 'check-files');
function editorNow() {
  var read = function (f) { return fs.readFileSync(path.join(here, 'editor', f), 'utf8'); };
  return read('editor.js').replace(/^---[\s\S]*?---\n/, '').replace(/\{% include_relative (\S+) %\}/g, function (m, f) { return read(f); });
}
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0, said = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  page.on('dialog', function (d) { said.push(d.message()); d.accept().catch(function () {}); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  if (local) { var ed = editorNow(); await page.route(/\/styles\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); }); }
  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000);
  if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]');
  await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 });
  var names = function () { return page.$$eval('#m2-list .m2-map .m2-name', function (l) { return l.map(function (x) { return x.textContent; }); }); };
  var before = await names();
  await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
  var chooser = page.waitForEvent('filechooser');
  await page.click('.m2-cx button:text-is("Add map from file")');
  var fc = await chooser;
  ok('1. the picker takes several files', fc.isMultiple());
  await fc.setFiles([
    { name: 'first-pick.xml', mimeType: 'text/xml', buffer: fs.readFileSync(path.join(checks, 'not-gate-one-input-v01.xml')) },
    { name: 'broken-pick.graphml', mimeType: 'text/xml', buffer: Buffer.from('not a map') },
    { name: 'second-pick.xml', mimeType: 'text/xml', buffer: fs.readFileSync(path.join(checks, 'or-gate-one-input-v01.xml')) }
  ]);
  await page.waitForTimeout(8000);
  var after = await names(), added = after.filter(function (n) { return before.indexOf(n) < 0; });
  ok('1. both maps added, in the order picked', added.join() === 'first-pick,second-pick' || added.join() === 'second-pick,first-pick', added.join());
  ok('1. the last one shown', /second-pick/.test(await page.evaluate(function () { return location.hash; })) || /second-pick/.test(await page.$eval('#m2-list .m2-map.m2-on .m2-name', function (x) { return x.textContent; }).catch(function () { return ''; })));
  ok('2. one message, naming the broken file', said.length === 1 && /broken-pick\.graphml/.test(said[0]) && !/first-pick|second-pick/.test(said[0]), JSON.stringify(said));
  // 3 and 4: GitHub played here (a repository in memory)
  var files = {}, trees = {}, commits = 0, maxEntries = 1e9, refuseNext = 0;
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '', meth = r.method();
    var json = function (st, o) { return route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    if (rest === '') return json(200, { permissions: { push: true } });
    if (rest === '/contents/maps') return json(200, Object.keys(files).filter(function (p) { return /^maps\/[^/]+$/.test(p); }).map(function (p) { return { name: p.slice(5), path: p, type: 'file' }; }));
    if (rest === '/git/ref/heads/main') return json(200, { object: { sha: 'c' + commits } });
    if (/^\/git\/commits\/c\d+$/.test(rest)) return json(200, { tree: { sha: 't' + commits } });
    if (rest === '/git/trees' && meth === 'POST') { var tr = JSON.parse(r.postData()).tree; if (tr.length > maxEntries) return json(422, { message: 'test: tree too large' }); var id = 'n' + Object.keys(trees).length; trees[id] = tr; return json(201, { sha: id }); }
    if (rest === '/git/commits' && meth === 'POST') { trees['c:' + (commits + 1)] = trees[JSON.parse(r.postData()).tree]; return json(201, { sha: 'c' + (commits + 1) }); }
    if (rest === '/git/refs/heads/main' && meth === 'PATCH') { if (refuseNext && commits >= refuseNext) return json(500, { message: 'test: refused' }); commits++; trees['c:' + commits].forEach(function (e) { files[e.path] = e.content; }); return json(200, {}); }
    return json(404, { message: 'Not Found' });
  });
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); });
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000);
  var recs = function () { return page.evaluate(function () { return new Promise(function (res) { var q = indexedDB.open('atlas-edit-drafts', 3); q.onsuccess = function () { try { var g = q.result.transaction('mine').objectStore('mine').getAll(); g.onsuccess = function () { res(g.result); }; } catch (e) { res([]); } }; q.onerror = function () { res([]); }; }); }); };
  var pick = async function (names) {
    if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]');
    await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 });
    await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
    var ch = page.waitForEvent('filechooser'); await page.click('.m2-cx button:text-is("Add map from file")');
    await (await ch).setFiles(names.map(function (n, i) { return { name: n + '.xml', mimeType: 'text/xml', buffer: fs.readFileSync(path.join(checks, ['not-gate-one-input-v01.xml', 'or-gate-one-input-v01.xml', 'unknown-gate-one-input-v01.xml'][i % 3])) }; }));
    await page.waitForTimeout(9000);
  };
  said.length = 0;
  var c0 = commits, n0 = Object.keys(files).length;   // the maps of 1, sent once the token is in
  await pick(['gh-a', 'gh-b', 'gh-c']);
  var rs = await recs(), shaOk = ['gh-a', 'gh-b', 'gh-c'].every(function (n) { var r = rs.filter(function (x) { return x.site === n; })[0]; return r && files['maps/' + n + '.xml'] != null && r.sha === gitSha(files['maps/' + n + '.xml']) && /order: \d+/.test(files['maps/' + n + '.md'] || ''); });
  ok('3. three maps in one commit', commits === c0 + 1 && Object.keys(files).length === n0 + 6, commits + ' commits, ' + Object.keys(files).join());
  ok('3. each record on the site with its sha', shaOk);
  maxEntries = 4;   // a tree of more than two maps refused
  await pick(['gh-d', 'gh-e', 'gh-f']);
  ok('4. refused as too large: sent in halves, all three added', commits === c0 + 3 && ['gh-d', 'gh-e', 'gh-f'].every(function (n) { return files['maps/' + n + '.xml'] != null; }) && !said.length, commits + ' commits ' + JSON.stringify(said));
  said.length = 0; refuseNext = commits + 1;   // the first half goes, the second is refused
  await pick(['gh-g', 'gh-g', 'gh-g']);
  var g = (await recs()).filter(function (r) { return /^gh-g/.test(r.title); }).map(function (r) { return r.title + '=' + r.site; }).sort();
  ok('5. first half kept, own names and ids', g.join() === 'gh-g (1)=gh-g-1,gh-g=gh-g' && files['maps/gh-g.xml'] && files['maps/gh-g-1.xml'], g.join());
  ok('5. the refused one named', said.length === 1 && /^Not added, gh-g\.xml: test: refused/.test(said[0]), JSON.stringify(said));
  ok('no script errors', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok'); process.exit(bad ? 1 : 0);
})();
