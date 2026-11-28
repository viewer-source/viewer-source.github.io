// The save clash: two tabs edit the same map, each from the version it opened. The first saves; the second, saving
// later, finds the map changed since it opened it. Neither version is lost. Each way of keeping maps:
// 1. GitHub (a token; GitHub played by this script, files from a clone of the site's data repository): the two versions
//    joined by element (editor/src/merge.js, core.js joinOpen): the two tabs moved different nodes, so GitHub has both
//    moves, silently, and the second tab goes on editing the joined map; both moved the same node: the second tab's
//    position, silently (a position alone is no clash); no copy either time.
// 2. and 3. keep the second tab's version as a copy beside it (in the same group of the list, under the map), said in
// its status line; no merge:
// 2. A folder on the computer (the browser's private file system, handed out by showDirectoryPicker), no token: the
//    map's file keeps the first tab's text, the second tab's is written beside it.
// 3. This browser, no token and no folder: the draft keeps the first tab's text, the second tab's is kept as a map of
//    the reader's.
// On the root page, Glycolysis (GraphML) moved by the arrow keys.
//   node tests/save-clash.js <base address> <clone of the site's data repository> [--local]
// --local: the editor of the working tree routed into the live page, to check before a release.
var engine = require('playwright')[process.env.BROWSER || 'chromium'], fs = require('fs'), path = require('path');
var NOISE = require('./lib/noise.js');   // what a browser reports that is no fault of the page
var base = process.argv[2] || 'https://viewer-source.github.io/';
var data = process.argv[3], local = process.argv.indexOf('--local') > 0;
if (!data) { console.log('usage: node tests/save-clash.js <base address> <clone of the data repository> [--local]'); process.exit(2); }
var MAP = 'glycolysis-graphml', bad = 0, ED = local ? require('./editor-now.js')(path.join(__dirname, '..')) : null;
var esb = require(require.resolve('esbuild', { paths: [path.join(__dirname, '..')] }));
var MG = { exports: {} }; new Function('module', 'exports', esb.transformSync(fs.readFileSync(path.join(__dirname, '../editor/src/merge.js'), 'utf8'), { format: 'cjs' }).code)(MG, MG.exports);
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };

function helpers(page) {
  var h = {};
  h.status = function () { return page.$eval('#m2-ed-status', function (s) { return s.textContent; }).catch(function () { return ''; }); };
  h.now = function () { return page.evaluate(function () { var n = window.m2EditNow(); return n ? n.text : null; }); };
  h.edit = async function () {
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    await page.click('.m2-ri[data-win="edit"]');
    await page.waitForFunction(function () { return !!window.m2EditNow(); }, null, { timeout: 30000 }); await page.waitForTimeout(1500);
  };
  h.move = async function (keys, nth) {   // nth: the nth node in view (0 the first)
    var c = await page.$$eval('#m2-img [data-n]', function (l, nth) { var k = 0; for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.left > 300 && r.top > 100 && r.right < 1380 && r.bottom < 880 && k++ === (nth || 0)) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; }, nth || 0);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    await page.mouse.click(c[0], c[1]); await page.waitForTimeout(300);
    for (var i = 0; i < 2; i++) { await page.keyboard.press(keys || 'Shift+ArrowRight'); await page.waitForTimeout(120); }
    await page.waitForTimeout(400);
  };
  h.open = async function () { await page.goto(base + '#' + MAP, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(1500); };
  h.listed = function (re) { return page.$$eval('#m2-list .m2-map', function (l, s) { var r = new RegExp(s, 'i'); return l.filter(function (e) { return r.test(e.textContent); }).length; }, re.source).catch(function () { return 0; }); };
  return h;
}
async function pages(ctx, n) {
  var out = [];
  for (var i = 0; i < n; i++) {
    var page = await ctx.newPage(), errs = [];
    page.on('pageerror', function (e) { if (!NOISE.test(e.message)) this.push(e.message); }.bind(errs));
    out.push({ page: page, errs: errs, h: helpers(page) });
  }
  return out;
}
async function routeLocal(ctx) { if (ED) await ctx.route(/\.io\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ED }); }); }

async function github(b) {
  console.log('-- GitHub');
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  await routeLocal(ctx);
  var sha = {}, body = {}, trees = [], blobs = {}, head = 'c0', n = 0;
  await ctx.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '';
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }).catch(function () {}); };
    if (!m) return json(404, {});
    if (rest === '') return json(200, { permissions: { push: true } });
    if (rest === '/git/ref/heads/main') return json(200, { object: { sha: head } });
    if (/^\/git\/commits\//.test(rest) && r.method() === 'GET') return json(200, { sha: head, tree: { sha: 't-' + head } });
    if (rest === '/git/trees' && r.method() === 'POST') { var d0 = JSON.parse(r.postData()); trees.push(d0.tree); return json(201, { sha: 'tree' + (++n) }); }
    if (rest === '/git/commits' && r.method() === 'POST') return json(201, { sha: 'c' + (++n) });
    if (rest === '/git/refs/heads/main') { head = JSON.parse(r.postData()).sha; trees[trees.length - 1].forEach(function (x) { body[x.path] = x.content; }); return json(200, { object: { sha: head } }); }
    if (/^\/git\/blobs/.test(rest)) { var d1 = JSON.parse(r.postData()); var s = 'b' + (++n); blobs[s] = d1.content; return json(201, { sha: s }); }
    var c = rest.match(/^\/contents\/([^?]+)/);
    if (c && r.method() === 'PUT') {
      var p = decodeURIComponent(c[1]), d = JSON.parse(r.postData());
      if (sha[p] && d.sha !== sha[p]) return json(409, { message: 'test: sha does not match' });
      body[p] = Buffer.from(d.content, 'base64').toString('utf8'); sha[p] = 'saved' + (++n);
      return json(200, { content: { sha: sha[p] } });
    }
    if (c) {
      var p2 = decodeURIComponent(c[1]), f = path.join(data, p2);
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) return json(200, fs.readdirSync(f).map(function (x) { return { name: x, path: p2 + '/' + x, type: 'file' }; }));
      var text = body[p2] != null ? body[p2] : fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f, 'utf8') : null;
      if (text == null) return json(404, { message: 'Not Found' });
      if (!sha[p2]) sha[p2] = 'start';
      if (/raw/.test(r.headers().accept || '')) return route.fulfill({ status: 200, contentType: 'text/plain', body: text }).catch(function () {});
      return json(200, { sha: sha[p2], content: Buffer.from(text).toString('base64') });
    }
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' }).catch(function () {});
    return json(404, { message: 'Not Found' });
  });
  var [A, B] = await pages(ctx, 2);
  await A.page.goto(base, { waitUntil: 'load' });
  await A.page.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-token', 'test-token'); });
  await A.h.open(); await A.h.edit(); await B.h.open(); await B.h.edit();
  var t0 = await B.h.now();
  await A.h.move(); await A.page.waitForTimeout(5000);
  var tA = await A.h.now(), p = Object.keys(body).filter(function (k) { return /glycolysis-graphml\.graphml$/.test(k); })[0];
  ok('the first tab saved', p && body[p] === tA, p);
  var others = function () { return Object.keys(body).filter(function (k) { return k !== p && /\.md$/.test(k) && /(other|your) version/.test(body[k]); }); };
  await B.h.move('Shift+ArrowDown', 3); var tB = await B.h.now(); await B.page.waitForTimeout(9000);
  var want = MG.exports.merge3(t0, tB, tA);
  ok('the second tab, another node moved: GitHub has both moves', tA !== t0 && tB !== t0 && !want.broken && !want.clashes && body[p] === want.text && body[p] !== tA && body[p] !== tB);
  ok('no copy, nothing said', !others().length && !(await B.h.status()) && !(await B.page.$eval('#m2-ed-wait', function (s) { return s.hidden ? '' : s.textContent; }).catch(function () { return ''; })), others().join(',') + ' ' + (await B.h.status()));
  ok('the second tab goes on editing the joined map', (await B.h.now()) === body[p]);
  await B.h.move('Shift+ArrowLeft', 3); var tB2 = await B.h.now(); await B.page.waitForTimeout(6000);
  ok('its next move saved over the joined map', tB2 !== want.text && body[p] === tB2);
  console.log('-- GitHub, the same node moved in both tabs');
  await A.h.open(); if (!(await A.page.evaluate(function () { return !!window.m2EditNow(); }))) await A.h.edit();   // the joined version read afresh
  await A.h.move('Shift+ArrowUp', 5); await A.page.waitForTimeout(5000);
  var tA3 = await A.h.now();
  ok('the first tab saved', body[p] === tA3);
  await B.h.move('Shift+ArrowRight', 5); var tB3 = await B.h.now(); await B.page.waitForTimeout(9000);
  var want3 = MG.exports.merge3(tB2, tB3, tA3);
  ok('the second tab\'s position kept, silently, no copy', want3.moved >= 1 && !want3.clashes && body[p] === want3.text && !others().length && !(await B.h.status()), JSON.stringify({ moved: want3.moved, clashes: want3.clashes, broken: want3.broken }));
  ok('no script error', !A.errs.length && !B.errs.length, A.errs.concat(B.errs).join(' | '));
  await ctx.close();
}

async function folder(b) {
  console.log('-- Folder');
  if ((process.env.BROWSER || 'chromium') !== 'chromium') { console.log('skip  this engine has no folder picker'); return; }
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  await routeLocal(ctx);
  await ctx.addInitScript(function () {
    window.showDirectoryPicker = function () { return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps', { create: true }); }); };
  });
  var [A, B] = await pages(ctx, 2);
  var files = function () {
    return A.page.evaluate(function () {
      return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps'); }).then(function (d) {
        var it = d.values(), out = {};
        return (function n() { return it.next().then(function (x) { if (x.done) return out; if (x.value.kind !== 'file') return n(); return x.value.getFile().then(function (f) { return f.text(); }).then(function (t) { out[x.value.name] = t; return n(); }); }); })();
      }).catch(function (e) { return { error: String(e) }; });
    });
  };
  await A.page.goto(base, { waitUntil: 'load' });
  await A.page.evaluate(function () { localStorage.clear(); });
  await A.h.open(); await A.h.edit();
  await A.h.move(); await A.page.waitForTimeout(2000);
  await A.page.click('#m2-ed-l-folder'); await A.page.waitForTimeout(3000);
  var f = await files(), nm = Object.keys(f)[0];
  ok('the first tab: a folder chosen, the map written there', !!nm && f[nm] === (await A.h.now()), Object.keys(f).join(','));
  await B.h.open(); await B.h.edit();   // opens the version in the folder
  await A.h.move(); await A.page.waitForTimeout(3000);
  var tA = await A.h.now(); f = await files();
  ok('the first tab moves again: written', f[nm] === tA);
  await B.h.move('Shift+ArrowDown'); var tB = await B.h.now(); await B.page.waitForTimeout(3000);
  f = await files();
  ok("the second tab: the first tab's file kept", f[nm] === tA);
  var beside = Object.keys(f).filter(function (k) { return k !== nm && f[k] === tB; });
  ok("the second tab's version written beside it", beside.length === 1, Object.keys(f).join(','));
  ok('and said', /beside/i.test(await B.h.status()), await B.h.status());
  ok('no script error', !A.errs.length && !B.errs.length, A.errs.concat(B.errs).join(' | '));
  await ctx.close();
}

async function browser(b) {
  console.log('-- This browser');
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  await routeLocal(ctx);
  var [A, B] = await pages(ctx, 2);
  var store = function (st, id) {   // the texts in a store of this site's database: maps (the drafts), mine (the reader's maps)
    return A.page.evaluate(function (a) {
      return new Promise(function (res) {
        var r = indexedDB.open('atlas-edit-drafts');
        r.onsuccess = function () { var d = r.result; if (!d.objectStoreNames.contains(a[0])) { d.close(); return res([]); } var q = d.transaction(a[0]).objectStore(a[0]).getAll(); q.onsuccess = function () { d.close(); res(q.result.filter(function (x) { return x && x.text && (!a[1] || x.id === a[1]); }).map(function (x) { return x.text; })); }; q.onerror = function () { d.close(); res([]); }; };
        r.onerror = function () { res([]); };
      });
    }, [st, id]);
  };
  await A.page.goto(base, { waitUntil: 'load' });
  await A.page.evaluate(function () { localStorage.clear(); });
  await A.h.open(); await A.h.edit(); await B.h.open(); await B.h.edit();
  await A.h.move(); await A.page.waitForTimeout(2500);
  var tA = await A.h.now();
  ok('the first tab: kept as a draft', (await store('maps', MAP))[0] === tA);
  await B.h.move('Shift+ArrowDown'); var tB = await B.h.now(); await B.page.waitForTimeout(3500);
  var drafts = await store('maps', MAP), mine = await store('mine');
  ok("the second tab: the first tab's draft kept", drafts[0] === tA, drafts.map(function (x) { return x === tA ? 'A' : x === tB ? 'B' : '?'; }).join(','));
  ok("the second tab's version kept as a map of the reader's", mine.filter(function (x) { return x === tB; }).length === 1, mine.map(function (x) { return x === tA ? 'A' : x === tB ? 'B' : '?'; }).join(','));
  ok('and said', /your version/i.test(await B.h.status()), await B.h.status());
  await B.h.move('Shift+ArrowLeft'); var tB2 = await B.h.now(); await B.page.waitForTimeout(3000);
  drafts = await store('maps', MAP); mine = await store('mine');
  ok('editing goes on in the copy: the next move kept there, the draft left as it was', drafts[0] === tA && mine.indexOf(tB2) >= 0 && tB2 !== tB);
  ok('the status line quiet again after that move', !(await B.h.status()), await B.h.status());
  ok('no script error', !A.errs.length && !B.errs.length, A.errs.concat(B.errs).join(' | '));
  await ctx.close();
}

(async function () {
  var b = await engine.launch();
  var only = process.env.ONLY;
  if (!only || only === 'github') await github(b);
  if (!only || only === 'folder') await folder(b);
  if (!only || only === 'browser') await browser(b);
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
