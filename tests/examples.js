// Example maps: the site's maps marked example: true (and their SBGN-ML twins), every other map the reader's.
// GitHub is played by this script (page.route on api.github.com, a repository held in memory); the list's examples
// are marked in index.json here as the build marks them.
//   1. No token, no maps of one's own, the site having other maps: Hide example maps offered; it leaves out the
//      examples (the twins too) and keeps the rest; Show example maps brings them back.
//   2. No token: Restore example maps lets go this browser's moves and Deleted marks of examples.
//   3. With a token: Restore example maps writes examples/ over maps/ in one commit and drops the examples' edited
//      SBGN-ML copies, leaving other maps' files alone; an example the build lists as deleted leaves Deleted at once.
//   4. Not offered while an example is edited.
//   5. Shown restored at once, before GitHub answers; GitHub refusing the commit puts the list back as it was.
//   6. A site group renamed (Rename group, a double-click): its maps' pages in one commit, examples among them the
//      reader's; Restore example maps then keeps them under new ids and brings the examples back beside them.
//   node tests/examples.js [base address] [--local]
// --local: the editor and the viewer of the working tree routed into the live page (run styles/update.sh first)
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
var EX = /^(glycolysis|srebp|acly|tag)-(graphml|celldesigner|sbgn)$/;   // the examples of this test (the build marks all 42 and their twins)
(async function () {
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  page.on('dialog', function (d) { if (d.type() === 'alert') console.log('alert: ' + d.message()); d.accept().catch(function () {}); });
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
  var files = {}, blobs = {}, trees = {}, commits = 0, slow = 0, refuse = false;
  var put = function (p, t) { files[p] = t; blobs[gitSha(t)] = t; };
  put('maps/glycolysis-graphml.graphml', '<graphml edited/>'); put('maps/glycolysis-graphml.md', '---\ntitle: "Glycolysis"\ngroup: "Testing"\norder: 1\nexample: true\n---\n');
  put('maps/sbgn-ml/glycolysis-sbgn.sbgn', '<sbgn edited/>'); put('maps/sbgn-ml/unnamed-sbgn.sbgn', '<sbgn other/>');
  put('maps/testing-glycolysis-graphml.md', '---\ntitle: "Mine"\n---\n');
  put('examples/README.md', 'backup');
  put('examples/maps/glycolysis-graphml.graphml', '<graphml official/>'); put('examples/maps/glycolysis-graphml.md', '---\ntitle: "Glycolysis"\ngroup: "GraphML"\norder: 1\nexample: true\n---\n');
  put('examples/maps/extra/glycolysis-graphml/glycolysis-graphml.png', 'png');
  put('examples/maps/srebp-celldesigner.xml', '<sbml official/>'); put('examples/maps/srebp-celldesigner.md', '---\ntitle: "SREBP"\nexample: true\n---\n');
  var treeOf = function (prefix, recursive) {   // the files under prefix as a git tree (blobs; with recursive also deeper)
    var out = {};
    Object.keys(files).forEach(function (p) {
      if (p.indexOf(prefix) !== 0) return;
      var rest = p.slice(prefix.length), dir = rest.indexOf('/');
      if (recursive || dir < 0) out[rest] = { path: rest, mode: '100644', type: 'blob', sha: gitSha(files[p]) };
      else out[rest.slice(0, dir)] = { path: rest.slice(0, dir), mode: '040000', type: 'tree', sha: 'tree:' + prefix + rest.slice(0, dir) + '/' };
    });
    return Object.keys(out).map(function (k) { return out[k]; });
  };
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? decodeURIComponent(m[1] || '') : '', meth = r.method();
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    if (rest === '') return json(200, { permissions: { push: true } });
    if (rest === '/git/ref/heads/main') return json(200, { object: { sha: 'c' + commits } });
    if (/^\/git\/commits\/c\d+$/.test(rest)) return json(200, { tree: { sha: 'tree:' } });
    var tg = rest.match(/^\/git\/trees\/(tree:.*)$/);
    if (tg && meth === 'GET' && slow) await new Promise(function (res) { setTimeout(res, slow); });
    if (tg && meth === 'GET') return json(200, { tree: treeOf(tg[1].slice(5), u.searchParams.get('recursive') === '1'), truncated: false });
    if (rest === '/git/trees' && meth === 'POST') {
      var tr = JSON.parse(r.postData()).tree, id = 'n' + Object.keys(trees).length;
      if (tr.some(function (e) { return e.sha === null && files[e.path] == null; })) return json(422, { message: 'test: deleting a path that is not there' });   // as GitHub
      trees[id] = tr; return json(201, { sha: id });
    }
    if (rest === '/git/commits' && meth === 'POST') { var d0 = JSON.parse(r.postData()); trees['c:' + (commits + 1)] = trees[d0.tree]; return json(201, { sha: 'c' + (commits + 1) }); }
    if (rest === '/git/refs/heads/main' && meth === 'PATCH' && refuse) return json(403, { message: 'test: refused' });
    if (rest === '/git/refs/heads/main' && meth === 'PATCH') {
      commits++; (trees['c:' + commits] || []).forEach(function (e) { if (e.sha === null) delete files[e.path]; else if (e.content != null) put(e.path, e.content); else files[e.path] = blobs[e.sha]; });
      return json(200, {});
    }
    var bl = rest.match(/^\/git\/blobs\/([0-9a-f]{40})$/);
    if (bl && meth === 'GET') return blobs[bl[1]] == null ? json(404, {}) : json(200, { content: Buffer.from(blobs[bl[1]]).toString('base64') });
    var c = rest.match(/^\/contents\/(.+)$/);
    if (c && meth === 'GET') {
      var p = c[1], under = Object.keys(files).filter(function (f) { return f.indexOf(p + '/') === 0; });
      if (files[p] != null) return json(200, { sha: gitSha(files[p]), content: Buffer.from(files[p]).toString('base64') });
      if (!under.length) return json(404, { message: 'Not Found' });
      var seen = {};
      return json(200, under.map(function (f) { var rest2 = f.slice(p.length + 1), d = rest2.indexOf('/'); var n = d < 0 ? rest2 : rest2.slice(0, d); if (seen[n]) return null; seen[n] = 1; return { name: n, path: p + '/' + n, type: d < 0 ? 'file' : 'dir' }; }).filter(Boolean));
    }
    return json(404, { message: 'Not Found' });
  });
  var built = {};   // id -> the deleted date the build would list
  await page.route('**/index.json*', async function (route) {
    var res = await route.fetch(), list = JSON.parse(await res.text());
    list.forEach(function (m) { m.example = EX.test(m.id); if (built[m.id]) m.deleted = built[m.id]; });
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) });
  });
  var ids = function () { return page.$$eval('#m2-list .m2-map:not(.m2-binned)', function (l) { return l.map(function (x) { return x.dataset.id; }); }); };
  var list = async function () { if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]'); await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 }); };
  var items = async function (sel) { await list(); await page.click(sel, { button: 'right' }); await page.waitForTimeout(300); var t = await page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); await page.keyboard.press('Escape'); await page.waitForTimeout(200); return t; };
  var menu = async function (sel, item) {
    await list();
    await page.click(sel, { button: 'right' }); await page.waitForTimeout(300);
    await page.click('.m2-cx button:text-is("' + item + '")'); await page.waitForTimeout(2000);
  };
  var load = async function (h) { await page.goto(base + '#' + (h || 'acly-graphml'), { waitUntil: 'load' }); await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000); };

  // 1. Hide and Show example maps
  await load(); await list();
  var all = await ids(), ex = all.filter(function (i) { return EX.test(i); });
  ok('1. the list has examples and other maps', ex.length >= 8 && all.length > ex.length, ex.length + ' of ' + all.length);
  var t = await items('#m2-list .m2-map >> nth=0');
  ok('1. Hide example maps offered with no maps of one\'s own', t.indexOf('Hide example maps') >= 0, t.join(' | '));
  ok('1. Restore example maps offered, at the end of the new maps\' items', t.indexOf('Restore example maps') === t.indexOf('Add group') + 1, t.join(' | '));
  await menu('#m2-list .m2-map >> nth=0', 'Hide example maps');
  var now = await ids();
  ok('1. hidden: no example left (twins too), every other map kept', !now.some(function (i) { return EX.test(i); }) && now.length === all.length - ex.length, now.length + ' of ' + all.length);
  await menu('#m2-list .m2-map >> nth=0', 'Show example maps');
  ok('1. shown again', (await ids()).length === all.length);

  // 2. No token: this browser's changes to examples let go
  await page.evaluate(function () {
    localStorage.setItem('atlas-moved:' + location.pathname, JSON.stringify({ 'acly-graphml': 'Testing', 'aspirin-graphml': 'Testing' }));
    localStorage.setItem('atlas-hidden-maps', JSON.stringify(['tag-celldesigner', 'aspirin-celldesigner']));
  });
  await load(); await list();
  ok('2. before: a hidden example out of the list', (await ids()).indexOf('tag-celldesigner') < 0);
  await menu('#m2-list .m2-map >> nth=0', 'Restore example maps');
  var st = await page.evaluate(function () { return [localStorage.getItem('atlas-moved:' + location.pathname), localStorage.getItem('atlas-hidden-maps')]; });
  ok('2. examples\' move and hiding let go, the others\' kept', st[0] === '{"aspirin-graphml":"Testing"}' && st[1] === '["aspirin-celldesigner"]', st.join(' | '));
  ok('2. the hidden example back in the list', (await ids()).indexOf('tag-celldesigner') >= 0);
  ok('2. no commit without a token', commits === 0);

  // 3. With a token: examples/ over maps/ in one commit
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); localStorage.removeItem('atlas-hidden-maps'); localStorage.removeItem('atlas-moved:' + location.pathname); });
  built['srebp-celldesigner'] = '2026-11-19T10:00:00Z';
  await load(); await list();
  ok('3. before: the deleted example in Deleted, out of the list', (await ids()).indexOf('srebp-celldesigner') < 0);
  await menu('#m2-list .m2-map >> nth=0', 'Restore example maps'); await page.waitForTimeout(1500);
  ok('3. the deleted example back in the list at once, the build not run', (await ids()).indexOf('srebp-celldesigner') >= 0);
  ok('3. one commit', commits === 1, commits + '');
  ok('3. the example\'s file and page from the backup', files['maps/glycolysis-graphml.graphml'] === '<graphml official/>' && /group: "GraphML"/.test(files['maps/glycolysis-graphml.md']));
  ok('3. a deleted example back, its extras too', files['maps/srebp-celldesigner.xml'] === '<sbml official/>' && files['maps/extra/glycolysis-graphml/glycolysis-graphml.png'] === 'png');
  ok('3. the example\'s edited SBGN-ML copy dropped, another map\'s kept', files['maps/sbgn-ml/glycolysis-sbgn.sbgn'] == null && files['maps/sbgn-ml/unnamed-sbgn.sbgn'] === '<sbgn other/>');
  ok('3. other maps and the backup untouched', files['maps/testing-glycolysis-graphml.md'] === '---\ntitle: "Mine"\n---\n' && files['examples/maps/glycolysis-graphml.graphml'] === '<graphml official/>' && files['maps/README.md'] == null);


  // 4. Not while an example is edited
  delete built['srebp-celldesigner'];
  await page.evaluate(function () { localStorage.setItem('atlas-edit-side', 'right'); });   // the Edit window beside the list
  await load('acly-graphml'); await list();
  await page.click('.m2-ri[data-win="edit"]'); await page.waitForSelector('.m2-grid.m2-editing, .m2-editing', { timeout: 30000 }).catch(function () {}); await page.waitForTimeout(2000);
  ok('4. editing, the list in sight', await page.evaluate(function () { return !!document.querySelector('.m2-editing') && !!document.querySelector('#m2-list .m2-map:not([hidden])'); }));
  var t4 = await items('#m2-list .m2-map >> nth=0');
  ok('4. editing an example: Restore example maps not offered', t4.length > 0 && t4.indexOf('Restore example maps') < 0, t4.join(' | '));
  var t5 = await items('#m2-list .m2-map[data-id="acly-graphml"]');
  ok('4. the map edited offers no Delete map', t5.indexOf('Delete map') < 0, t5.join(' | '));

  // 5. at once, and back on a refusal
  await page.evaluate(function () { localStorage.setItem('atlas-edit-side', 'left'); });
  built['srebp-celldesigner'] = '2026-11-19T10:00:00Z';
  slow = 6000; refuse = true;
  var alerts = [];
  page.on('dialog', function (d) { if (d.type() === 'alert') alerts.push(d.message()); });
  await load(); await list();
  ok('5. before: the deleted example out of the list', (await ids()).indexOf('srebp-celldesigner') < 0);
  await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
  await page.click('.m2-cx button:text-is("Restore example maps")'); await page.waitForTimeout(800);
  ok('5. within a second, GitHub not answered yet: the example back in the list', (await ids()).indexOf('srebp-celldesigner') >= 0);
  await page.waitForTimeout(16000);   // two slow tree reads, one after the other
  ok('5. GitHub refused: said, and the example back in Deleted', alerts.some(function (a) { return /not restored/.test(a); }) && (await ids()).indexOf('srebp-celldesigner') < 0, alerts.join(' | '));
  slow = 0; refuse = false;

  // 6. a site group renamed, then the examples restored
  await page.evaluate(function () { localStorage.removeItem('atlas-edit-side'); });
  await load(); await list();
  var inG = await page.evaluate(function () { return Array.prototype.slice.call(document.querySelectorAll('#m2-list .m2-map[data-id$="-graphml"]')).map(function (b) { return b.dataset.id; }); });
  inG.forEach(function (id) { if (!files['maps/' + id + '.md'] || id === 'glycolysis-graphml') put('maps/' + id + '.md', '---\ntitle: "' + id + '"\ngroup: "GraphML"\norder: 1\n' + (EX.test(id) ? 'example: true\n' : '') + '---\nText.\n'); });
  put('maps/glycolysis-graphml.graphml', '<graphml mine/>'); put('maps/extra/glycolysis-graphml/glycolysis-graphml.png', 'my png');
  put('maps/sbgn-ml/glycolysis-sbgn.sbgn', '<sbgn my twin/>'); put('maps/colours/glycolysis-graphml.json', '{"mine":1}');
  put('maps/colours/glycolysis-2-graphml.json', '{"stray":1}');   // -2 taken by a stray file: -3
  var t6 = await items('#m2-list .m2-group[data-group="GraphML"]');
  ok('6. Rename group offered on a site group', t6[0] === 'Rename group', t6.join(' | '));
  var c6 = commits;
  await menu('#m2-list .m2-map[data-id="glycolysis-graphml"]', 'Rename map');   // a name field open, then Rename group
  await page.click('#m2-list .m2-group[data-group="GraphML"]', { button: 'right' }); await page.waitForTimeout(300);
  await page.click('.m2-cx button:text-is("Rename group")'); await page.waitForTimeout(500);
  ok('6. Rename group with another name field open: its own field', (await page.$$('#m2-list input')).length === 1 && !!(await page.$('#m2-list input.m2-group-edit')));
  await page.fill('#m2-list input.m2-group-edit', '""'); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  ok('6. a name of quotes only: nothing renamed', commits === c6 && !!(await page.$('#m2-list .m2-group[data-group="GraphML"]')));
  await page.click('#m2-list .m2-group[data-group="GraphML"]'); await page.waitForTimeout(100); await page.click('#m2-list .m2-group[data-group="GraphML"]'); await page.waitForTimeout(400);
  ok('6. a double-click opens the name in place', !!(await page.$('#m2-list input.m2-group-edit')));
  await page.fill('#m2-list input.m2-group-edit', 'My GraphML'); await page.keyboard.press('Enter'); await page.waitForTimeout(2500);
  ok('6. one commit, every page of the group renamed, the example the reader\'s now', commits === c6 + 1 && /group: "My GraphML"/.test(files['maps/glycolysis-graphml.md']) && !/example:/.test(files['maps/glycolysis-graphml.md']) && /Text\.\n$/.test(files['maps/glycolysis-graphml.md']), commits - c6 + ' ' + JSON.stringify(files['maps/glycolysis-graphml.md']));
  ok('6. the list shows the group under its new name at once', !!(await page.$('#m2-list .m2-group[data-group="My GraphML"]')) && !(await page.$('#m2-list .m2-group[data-group="GraphML"]')));
  await menu('#m2-list .m2-map >> nth=0', 'Restore example maps'); await page.waitForTimeout(2500);
  ok('6. restored: the reader\'s map kept under a new id with its files (-2 taken: -3)', files['maps/glycolysis-3-graphml.graphml'] === '<graphml mine/>' && /My GraphML/.test(files['maps/glycolysis-3-graphml.md'] || '') && files['maps/extra/glycolysis-3-graphml/glycolysis-3-graphml.png'] === 'my png' && files['maps/sbgn-ml/glycolysis-3-sbgn.sbgn'] === '<sbgn my twin/>' && files['maps/colours/glycolysis-3-graphml.json'] === '{"mine":1}' && files['maps/colours/glycolysis-2-graphml.json'] === '{"stray":1}', Object.keys(files).filter(function (f) { return /glycolysis-[23]/.test(f); }).join(' '));
  ok('6. the example\'s own twin and colours not left at the old id', files['maps/sbgn-ml/glycolysis-sbgn.sbgn'] == null && files['maps/colours/glycolysis-graphml.json'] == null);
  ok('6. the example back beside it, from the backup', files['maps/glycolysis-graphml.graphml'] === '<graphml official/>' && /group: "GraphML"/.test(files['maps/glycolysis-graphml.md']) && files['maps/extra/glycolysis-graphml/glycolysis-graphml.png'] === 'png');

  ok('no script errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
