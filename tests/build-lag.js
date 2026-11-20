// A site map's page written from the list (Delete map, Restore, Move to) while the site's builds lag behind: the list
// keeps what this page did until a build of that write or later (its entry's written, stamped into the page), never an
// earlier build, also one that agrees (a restore gives the page as it was before the delete). GitHub and the builds are played by this script.
//   1. Delete map, then Cmd+Z (Restore); an old build (before the delete) served, then the delete's build: the map stays
//      out of Deleted; the restore's build settles it (atlas-page-sent emptied); every write stamps written:.
//   2. Move to... another group, then to a third: an older build agreeing, then the first move's build: the map stays
//      where it was put; the last move's build settles it.
//   3. Move to... puts the map first in the group, in the list and in its page's order.
//   4. Make a copy: the copy shown, no name field open.
//   5. Move to..., Cmd+Z: its page back with its order; the move's build arriving after the undo changes nothing.
//   node tests/build-lag.js [base address] [--local]
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
  if (process.env.DBG) await page.addInitScript(function () { var r = Storage.prototype.removeItem, w = Storage.prototype.setItem; Storage.prototype.removeItem = function (k) { if (/page-sent|bin-pending/.test(k)) console.log('DBG remove ' + k + ' ' + new Error().stack.split('\n').slice(2, 6).join(' / ')); return r.apply(this, arguments); }; Storage.prototype.setItem = function (k, v) { if (/page-sent|bin-pending/.test(k)) console.log('DBG set ' + k + ' ' + v); return w.apply(this, arguments); }; });
  page.on('console', function (m) { if (/^DBG/.test(m.text())) console.log(m.text().slice(0, 400)); });
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
  var built = { deleted: '', group: 'Testing', written: '' };   // the build the site serves for SID
  var inFlight = false, refused = 0, refuseNext = false;
  var snap = function () { var w, t = files['maps/' + SID + '.md'], d = t.match(/^deleted: "(.*)"$/m), g = t.match(/^group: "(.*)"$/m); w = t.match(/^written: "(.*)"$/m); return { deleted: d ? d[1] : '', group: g ? g[1] : '', written: w ? w[1] : '' }; };
  await page.route('**/index.json*', async function (route) {
    var res = await route.fetch(), list = JSON.parse(await res.text());
    list.forEach(function (m) { m.deleted = ''; if (m.id === SID) Object.assign(m, built); });
    if (!list.some(function (m) { return m.id === SID; })) { var g = list.filter(function (m) { return /graphml$/.test(m.id); })[0]; list.push(Object.assign({}, g, { id: SID, title: 'Copy of Glycolysis', topic: 'Copy of Glycolysis', example: false }, built)); }
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) });
  });
  var ids = function () { return page.$$eval('#m2-list .m2-map:not(.m2-binned)', function (l) { return l.map(function (x) { return x.dataset.id; }); }); };
  var binned = async function () { var h = await page.$('#m2-list .m2-bin.m2-shut'); if (h) { await h.click(); await page.waitForTimeout(300); } return page.$$eval('#m2-list .m2-binned', function (l) { return l.map(function (x) { return x.dataset.id; }); }); };
  var groupOf = function (id) { return page.$eval('#m2-list .m2-map[data-id="' + id + '"]', function (x) { return x.dataset.group; }).catch(function () { return null; }); };
  var sent = function () { return page.evaluate(function () { return localStorage.getItem('atlas-page-sent:' + location.pathname); }); };
  var list = async function () { if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]'); await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 }); };
  var menu = async function (sel, item) { await list(); await page.click(sel, { button: 'right' }); await page.waitForTimeout(300); await page.click('.m2-cx button:text-is("' + item + '")'); await page.waitForTimeout(2000); };
  var moveTo = async function (g) { await menu('#m2-list .m2-map[data-id="' + SID + '"]', 'Move to...'); await page.click('.m2-cx button:text-is("' + g + '")'); await page.waitForTimeout(2500); };
  var load = async function () { await page.goto(base + '#f001-glycolysis', { waitUntil: 'load' }); await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000); await list(); };
  var mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.goto(base, { waitUntil: 'load' }); await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); });
  await load();
  var b0 = Object.assign({}, built);
  // 1.
  await menu('#m2-list .m2-map[data-id="' + SID + '"]', 'Delete map');
  var b1 = snap();
  ok('1. deleted: its page has deleted:', !!b1.deleted && (await binned()).indexOf(SID) >= 0);
  await page.click('#m2-list .m2-map:not(.m2-binned) >> nth=0'); await page.waitForTimeout(500);
  await page.keyboard.press(mod + '+z'); await page.waitForTimeout(2500);
  var b2 = snap();
  ok('1. Cmd+Z: restored on its page', !b2.deleted && (await ids()).indexOf(SID) >= 0);
  built = b0; await load();
  ok('1. the build before the delete (agreeing): in the list', (await ids()).indexOf(SID) >= 0 && (await binned()).indexOf(SID) < 0);
  built = b1; await load();
  ok('1. then the delete\'s build: still in the list, not in Deleted', (await ids()).indexOf(SID) >= 0 && (await binned()).indexOf(SID) < 0, JSON.stringify(await binned()) + ' sent ' + (await sent()) + ' pend ' + (await page.evaluate(function () { return localStorage.getItem('atlas-bin-pending'); })));
  built = b2; await load();
  ok('1. the restore\'s build: in the list, nothing held', (await ids()).indexOf(SID) >= 0 && !(await sent()), await sent());
  // 2. and 3.
  await moveTo('GraphML');
  var b3 = snap();
  var gl = await page.$$eval('#m2-list .m2-map[data-group="GraphML"]', function (l) { return l.map(function (x) { return x.dataset.id; }); });
  ok('3. Move to...: first in the group', gl[0] === SID, gl.slice(0, 3).join());
  var o3 = +files['maps/' + SID + '.md'].match(/^order: (-?\d+)$/m)[1];
  ok('3. its page\'s order before the group\'s first', b3.group === 'GraphML' && o3 < 1, 'order ' + o3);
  await moveTo('CellDesigner');
  var b4 = snap();
  built = { deleted: '', group: 'CellDesigner', written: '' }; await load();
  ok('2. an older build that agrees: in CellDesigner', (await groupOf(SID)) === 'CellDesigner', await groupOf(SID));
  built = b3; await load();
  ok('2. then the first move\'s build: still in CellDesigner', (await groupOf(SID)) === 'CellDesigner', await groupOf(SID));
  built = b4; await load();
  ok('2. the last move\'s build: in CellDesigner, nothing held', (await groupOf(SID)) === 'CellDesigner' && !(await sent()), await sent());
  // 5. Move to..., then Cmd+Z: back with its order; the move's build after it changes nothing
  var o4 = files['maps/' + SID + '.md'].match(/^order: (-?\d+)$/m)[1];
  await moveTo('GraphML');
  var b5 = snap();
  await page.click('#m2-list .m2-map[data-id="' + SID + '"] .m2-name'); await page.waitForTimeout(500);
  await page.keyboard.press(mod + '+z'); await page.waitForTimeout(3000);
  var b6 = snap();
  ok('5. Cmd+Z: its page back in CellDesigner, its order as before', b6.group === 'CellDesigner' && files['maps/' + SID + '.md'].match(/^order: (-?\d+)$/m)[1] === o4, b6.group + ' ' + o4);
  built = b5; await load();
  ok('5. the move\'s build after the undo: still in CellDesigner', (await groupOf(SID)) === 'CellDesigner', await groupOf(SID));
  built = b6; await load();
  ok('5. the undo\'s build: in CellDesigner, nothing held', (await groupOf(SID)) === 'CellDesigner' && !(await sent()), await sent());
  // 4.
  await menu('#m2-list .m2-map[data-id="' + SID + '"]', 'Make a copy'); await page.waitForTimeout(1500);
  ok('4. Make a copy: no name field open', !(await page.$('#m2-list input')));
  ok('no script errors', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok'); process.exit(bad ? 1 : 0);
})();
