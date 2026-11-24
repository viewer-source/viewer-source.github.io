// A map made from a tool's text (window.m2Tools, editor/src/tools.js; own.js fromTool): a tool registered on the page
// runs on the map shown and adds its text as a new map of the reader's, right under the map in its group, opened, in
// every way of keeping maps:
// 1. GitHub (a token; GitHub played by this script, files from a clone of the site's data repository): committed as
//    maps/<id>.<ext> with its page in the map's group.
// 2. A folder on the computer (the browser's private file system, handed out by showDirectoryPicker), no token: written
//    there as its file.
// 3. This browser, no token and no folder: kept as a map of the reader's; Cmd+Z in the list puts it in Deleted.
// In each: a tool's text of the map's own format (GraphML), a text of another format (an SBGN-ML made here) kept as
// that format, and another editor's SBGN-ML refused with nothing added. On the styles page, Glycolysis (GraphML).
//   node tests/tool-map.js <base address> <clone of the site's data repository> [--local]
// --local: the editor of the working tree routed into the live page, to check before a release.
var engine = require('playwright')[process.env.BROWSER || 'chromium'], fs = require('fs'), path = require('path');
var NOISE = require('./lib/noise.js');   // what a browser reports that is no fault of the page
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
var data = process.argv[3], local = process.argv.indexOf('--local') > 0;
if (!data) { console.log('usage: node tests/tool-map.js <base address> <clone of the data repository> [--local]'); process.exit(2); }
var MAP = 'glycolysis-graphml', MARK = '<!-- made by the test tool -->', bad = 0, ED = local ? require('./editor-now.js')(path.join(__dirname, '..')) : null;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
var SB_HERE = '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3">\n  <map id="viewer-new-map" language="process description">\n  </map>\n</sbgn>\n';
var SB_OTHER = SB_HERE.replace('viewer-new-map', 'from-another-editor');

async function open(ctx, setup) {
  if (ED) await ctx.route(/\/styles\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ED }); });
  var page = await ctx.newPage(), errs = [];
  page.on('pageerror', function (e) { if (!NOISE.test(e.message)) errs.push(e.message); });
  page.on('dialog', function (d) { d.accept().catch(function () {}); });
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(setup || function () { localStorage.clear(); });
  await page.goto(base + '#' + MAP, { waitUntil: 'load' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(function () { return !!window.m2Tools; }, null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.evaluate(function (a) {
    window.m2Tools.register({ id: 'mark', label: 'Marked', kinds: ['GraphML'], run: function (ctx) { return ctx.text().then(function (t) { return ctx.add(t.replace('</graphml>', a[0] + '\n</graphml>')); }); } });
    window.m2Tools.register({ id: 'to-sbgn', label: 'Empty SBGN-ML', kinds: ['*'], run: function (ctx) { return ctx.add(a[1], 'Made by a tool'); } });
    window.m2Tools.register({ id: 'other', kinds: ['*'], run: function (ctx) { return ctx.add(a[2]); } });
    window.m2Tools.register({ id: 'cd-only', kinds: ['CellDesigner'], run: function () { return 1; } });
  }, [MARK, SB_HERE, SB_OTHER]);
  return { page: page, errs: errs };
}
async function common(P, kept, label) {   // kept(): { texts: [text], files: [name] } in this way of keeping maps
  var page = P.page;
  var tools = await page.evaluate(function () { return window.m2Tools.forMap().map(function (t) { return t.id; }).join(','); });
  ok('the tools for a GraphML map listed, the CellDesigner one left out', tools === 'mark,to-sbgn,other', tools);
  var src = await page.evaluate(function () { var r = document.querySelector('#m2-list .m2-map[data-id="glycolysis-graphml"]'); return r ? r.textContent : ''; });
  var made = await page.evaluate(function () { return window.m2Tools.run('mark').then(function (r) { return r; }, function (e) { return { err: e.message }; }); });
  await page.waitForTimeout(label === 'on GitHub' ? 3000 : 1500);
  ok('the tool\'s map made', made && made.id && !made.err, JSON.stringify(made));
  ok('named after its source and the tool', made && /\(Marked\)$/.test(made.name || '') && made.name.indexOf(src.replace(/\.graphml$/, '').trim().split(' (')[0]) === 0, (made && made.name) + ' / ' + src);
  var k = await kept();
  ok('kept ' + label + ' with the tool\'s text', k.texts.filter(function (t) { return t.indexOf(MARK) >= 0; }).length === 1, k.files.join(','));
  var near = await page.evaluate(function (id) {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#m2-list .m2-map')), i = rows.findIndex(function (r) { return r.dataset.id === 'glycolysis-graphml'; });
    var j = rows.findIndex(function (r) { return r.dataset.id === id || (r.textContent || '').indexOf('(Marked)') >= 0; });
    return [i, j, location.hash];
  }, made && made.id);
  ok('right under its source in the list', near[0] >= 0 && near[1] === near[0] + 1, near.join(' '));
  ok('opened', near[2] !== '#' + MAP, near[2]);
  await page.click('#m2-list .m2-map[data-id="' + MAP + '"]'); await page.waitForTimeout(1500);   // the source shown again: its tools
  var sb = await page.evaluate(function () { return window.m2Tools.run('to-sbgn').then(function (r) { return r; }, function (e) { return { err: e.message }; }); });
  await page.waitForTimeout(label === 'on GitHub' ? 3000 : 1500);
  k = await kept();
  ok('a text of another format kept as that format (.sbgn)', sb && !sb.err && sb.name === 'Made by a tool' && k.files.some(function (f) { return /\.sbgn$/.test(f); }), JSON.stringify(sb) + ' ' + k.files.join(','));
  var n = k.texts.length;
  var no = await page.evaluate(function () { return window.m2Tools.run('other').then(function () { return ''; }, function (e) { return e.message; }); });
  await page.waitForTimeout(1500);
  ok('another editor\'s SBGN-ML refused, with the reason', /another editor/.test(no), no);
  ok('and nothing added', (await kept()).texts.length === n);
  return made;
}

async function github(b) {
  console.log('-- GitHub');
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  var body = {}, trees = [], head = 'c0', n = 0, sha = {};
  await ctx.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '';
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }).catch(function () {}); };
    if (!m) return json(404, {});
    if (rest === '') return json(200, { permissions: { push: true } });
    if (rest === '/git/ref/heads/main') return json(200, { object: { sha: head } });
    if (/^\/git\/commits\//.test(rest) && r.method() === 'GET') return json(200, { sha: head, tree: { sha: 't-' + head } });
    if (rest === '/git/trees' && r.method() === 'POST') { trees.push(JSON.parse(r.postData()).tree); return json(201, { sha: 'tree' + (++n) }); }
    if (rest === '/git/commits' && r.method() === 'POST') return json(201, { sha: 'c' + (++n) });
    if (rest === '/git/refs/heads/main') { head = JSON.parse(r.postData()).sha; trees[trees.length - 1].forEach(function (x) { body[x.path] = x.content; }); return json(200, { object: { sha: head } }); }
    if (/^\/git\/blobs/.test(rest)) return json(201, { sha: 'b' + (++n) });
    var c = rest.match(/^\/contents\/([^?]+)/);
    if (c && r.method() === 'PUT') { var p = decodeURIComponent(c[1]), d = JSON.parse(r.postData()); body[p] = Buffer.from(d.content, 'base64').toString('utf8'); sha[p] = 's' + (++n); return json(200, { content: { sha: sha[p] } }); }
    if (c) {
      var p2 = decodeURIComponent(c[1]), f = path.join(data, p2);
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) return json(200, fs.readdirSync(f).concat(Object.keys(body).filter(function (k) { return k.indexOf(p2 + '/') === 0; }).map(function (k) { return k.slice(p2.length + 1); })).map(function (x) { return { name: x, path: p2 + '/' + x, type: 'file' }; }));
      var text = body[p2] != null ? body[p2] : fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f, 'utf8') : null;
      if (text == null) return json(404, { message: 'Not Found' });
      if (/raw/.test(r.headers().accept || '')) return route.fulfill({ status: 200, contentType: 'text/plain', body: text }).catch(function () {});
      return json(200, { sha: sha[p2] || 'start', content: Buffer.from(text).toString('base64') });
    }
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' }).catch(function () {});
    return json(404, { message: 'Not Found' });
  });
  var P = await open(ctx, function () { localStorage.clear(); localStorage.setItem('atlas-edit-token', 'test-token'); });
  var kept = function () { var ks = Object.keys(body).filter(function (k) { return /^maps\/[^/]+\.(graphml|xml|sbgn)$/.test(k); }); return Promise.resolve({ texts: ks.map(function (k) { return body[k]; }), files: ks }); };
  var made = await common(P, kept, 'on GitHub');
  var md = Object.keys(body).filter(function (k) { return /\.md$/.test(k) && /Marked/.test(body[k]); }).map(function (k) { return body[k]; })[0] || '';
  var grp = (fs.readFileSync(path.join(data, 'maps', MAP + '.md'), 'utf8').match(/^group:.*$/m) || [''])[0];
  ok('its page in the source\'s group', !!md && md.indexOf(grp) >= 0, md.replace(/\n/g, ' ') + ' / ' + grp);
  ok('no script error', !P.errs.length, P.errs.join(' | '));
  await ctx.close();
}

async function folder(b) {
  console.log('-- Folder');
  if ((process.env.BROWSER || 'chromium') !== 'chromium') { console.log('skip  this engine has no folder picker'); return; }
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(function () {
    window.showDirectoryPicker = function () { return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps', { create: true }); }); };
  });
  var P = await open(ctx);
  await P.page.evaluate(function () { return window.m2Editor && document.querySelector('#m2-ed-l-folder'); });
  await P.page.click('.m2-ri[data-win="edit"]'); await P.page.waitForFunction(function () { return !!window.m2EditNow(); }, null, { timeout: 30000 }); await P.page.waitForTimeout(1500);
  await P.page.evaluate(function () { var b = document.querySelector('#m2-ed-l-folder'); if (b) b.click(); }); await P.page.waitForTimeout(2500);
  await P.page.click('.m2-ri[data-win="edit"]').catch(function () {}); await P.page.waitForTimeout(800);   // editing left: the list's maps are the work
  var kept = function () {
    return P.page.evaluate(function () {
      return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps'); }).then(function (d) {
        var it = d.values(), out = { texts: [], files: [] };
        return (function n() { return it.next().then(function (x) { if (x.done) return out; if (x.value.kind !== 'file') return n(); return x.value.getFile().then(function (f) { return f.text(); }).then(function (t) { out.texts.push(t); out.files.push(x.value.name); return n(); }); }); })();
      }).catch(function (e) { return { texts: [], files: ['error: ' + e] }; });
    }).then(function (k) { var i = k.files.map(function (f, j) { return /^glycolysis/i.test(f) && k.texts[j].indexOf('<!--') < 0 ? -1 : j; }).filter(function (j) { return j >= 0; }); return { texts: i.map(function (j) { return k.texts[j]; }), files: i.map(function (j) { return k.files[j]; }) }; });
  };
  await common(P, kept, 'in the folder');
  ok('no script error', !P.errs.length, P.errs.join(' | '));
  await ctx.close();
}

async function browser(b) {
  console.log('-- This browser');
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  var P = await open(ctx);
  var recs = function () {
    return P.page.evaluate(function () {
      return new Promise(function (res) {
        var r = indexedDB.open('atlas-edit-drafts');
        r.onsuccess = function () { var d = r.result; if (!d.objectStoreNames.contains('mine')) { d.close(); return res([]); } var q = d.transaction('mine').objectStore('mine').getAll(); q.onsuccess = function () { d.close(); res(q.result.filter(function (x) { return x && x.text; }).map(function (x) { return { text: x.text, file: x.file, hidden: !!x.hidden, id: x.id }; })); }; q.onerror = function () { d.close(); res([]); }; };
        r.onerror = function () { res([]); };
      });
    });
  };
  var kept = function () { return recs().then(function (l) { l = l.filter(function (x) { return !x.hidden; }); return { texts: l.map(function (x) { return x.text; }), files: l.map(function (x) { return x.file; }) }; }); };
  await common(P, kept, 'in this browser');
  await P.page.click('#m2-list .m2-map[data-id="' + MAP + '"]').catch(function () {}); await P.page.waitForTimeout(800);
  await P.page.keyboard.press('Control+z'); await P.page.waitForTimeout(1500);
  var after = await recs();
  ok('Cmd+Z in the list: the last map made goes to Deleted', after.filter(function (x) { return /\.sbgn$/.test(x.file); }).every(function (x) { return x.hidden; }) && after.some(function (x) { return x.text.indexOf(MARK) >= 0 && !x.hidden; }), JSON.stringify(after.map(function (x) { return x.file + (x.hidden ? ' hidden' : ''); })));
  var gone = after.filter(function (x) { return x.hidden; })[0];
  if (gone) {
    await P.page.evaluate(function (id) { location.hash = '#' + id; }, gone.id); await P.page.waitForTimeout(1500);
    var no2 = await P.page.evaluate(function (id) { return window.m2Tools.forMap().length && location.hash === '#' + id ? window.m2Tools.run('to-sbgn').then(function () { return 'made'; }, function (e) { return e.message; }) : 'not shown'; }, gone.id);
    ok('a map in Deleted is no tool\'s source', /in Deleted/.test(no2), no2);
  }
  await P.page.click('#m2-list .m2-map[data-id="' + MAP + '"]').catch(function () {}); await P.page.waitForTimeout(1000);
  var two = await P.page.evaluate(function (a) {
    window.m2Tools.register({ id: 'twice', label: 'Twice', kinds: ['*'], run: function (ctx) { return Promise.all([ctx.add(a + '<!--1-->'), ctx.add(a + '<!--2-->'), ctx.add(a + '<!--3-->', '***')]); } });
    return window.m2Tools.run('twice').then(function (r) { return r.map(function (x) { return x.name; }); }, function (e) { return [e.message]; });
  }, SB_HERE);
  await P.page.waitForTimeout(2000);
  var all = await recs(), f2 = all.filter(function (x) { return /<!--[123]-->/.test(x.text); }).map(function (x) { return x.file; });
  ok('several maps asked for at once: each its own name and file', two.length === 3 && two[0] !== two[1] && f2.length === 3 && new Set(f2).size === 3, two.join(' | ') + ' / ' + f2.join(','));
  ok('a name of no letters a to z: a file name all the same', f2.every(function (f) { return /^[a-z0-9]/.test(f); }), f2.join(','));
  ok('no script error', !P.errs.length, P.errs.join(' | '));
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
