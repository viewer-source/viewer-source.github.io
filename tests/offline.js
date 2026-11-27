// The outbox (editor/src/outbox.js, core.js sendWaiting): with a token a map's moves are kept in this browser before they
// are sent, so a lost connection, a reload or a closed tab loses nothing; said by one grey line and a cloud by the map,
// never in red; sent again when the connection is back. GitHub is played by this script (a repository in memory);
// "down" fails every request to it as a lost connection would, "refused" answers 401.
//   node tests/offline.js [base address] [--local]
// --local: the editor and the viewer of the working tree routed into the live page (as tests/edit-reload.js).
// Parts: A a move offline kept and said; B a reload offline keeps it; C the connection back sends it; D a file changed on
// GitHub meanwhile: the two joined by element (editor/src/merge.js), silently where they changed different things, and
// where both changed one node the reader's kept, the other version kept as a copy and said until the next move;
// K two machines, a large edit and a small one made on the version before it, sent in either order; E the token refused; F a reload with the
// connection back sends at once, and the map opens from GitHub's new version; G the map open in the editor sent when the
// connection is back; I another tab's newer text sent, not this tab's older one; J the token pasted again sends what
// waits; H no token: nothing sent when the connection comes back.
var { chromium } = require('playwright'), crypto = require('crypto'), path = require('path'), cp = require('child_process');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0;
var base = args.filter(function (a) { return a[0] !== '-'; })[0] || 'https://viewer-source.github.io/styles/';
var here = path.join(__dirname, '..');
var gitSha = function (t) { var b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex'); };
var ID = 'glycolysis-graphml', FILE = 'maps/glycolysis-graphml.graphml';
function viewerHunks() {   // per piece of the styles page's viewer changed since HEAD, [old, new] with its context, then trimmed by
  // one line a side at a time (context Jekyll rewrote, a liquid tag, does not match the page)
  var d = cp.execFileSync('git', ['diff', '-U2', process.env.REV || 'HEAD', '--', '../styles/_includes/atlas-app.html'], { cwd: here, maxBuffer: 1 << 26 }).toString(), out = [];
  d.split(/\n(?=@@ )/).slice(1).forEach(function (h) {
    var o = [], n = [], tries = [];
    h.split('\n').slice(1).forEach(function (l) { if (l[0] === ' ') { o.push(l.slice(1)); n.push(l.slice(1)); } else if (l[0] === '-') o.push(l.slice(1)); else if (l[0] === '+') n.push(l.slice(1)); });
    for (var k = 0; k < 3 && o.length - 2 * k > 0; k++) tries.push([o.slice(k, o.length - k).join('\n'), n.slice(k, n.length - k).join('\n')]);
    out.push(tries);
  });
  return out;
}
var bad = 0;
function ok(what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); }
(async function () {
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage();
  var S = { net: 'up', files: {}, puts: 0, errs: [], dialogs: [] }, f = S.files;
  page.on('pageerror', function (e) { S.errs.push(e.message); });
  page.on('console', function (m) { if (m.type() === 'error' && process.env.DEBUG) console.log('   console: ' + m.text()); });
  page.on('dialog', function (d) { S.dialogs.push(d.type() + ': ' + d.message()); d.accept().catch(function () {}); });
  if (local) {
    var ed = require('./editor-now.js')(here), hunks = viewerHunks();
    await page.route(/\/styles\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await page.route(function (u) { return u.href.split('#')[0] === base.split('#')[0]; }, async function (r) {
      var res = await r.fetch(), t = await res.text(), miss = 0;
      hunks.forEach(function (tries) {
        var h = tries.filter(function (x) { return x[0] && t.indexOf(x[0]) >= 0; })[0];
        if (h) t = t.replace(h[0], function () { return h[1]; }); else miss++;
      });
      if (miss) { bad++; console.log('WRONG the viewer\'s changes did not apply to the page (' + miss + ' of ' + hunks.length + ')'); }
      r.fulfill({ response: res, body: t, headers: Object.assign({}, res.headers(), { 'content-type': 'text/html; charset=utf-8' }) });
    });
  }
  f['maps/glycolysis-graphml.md'] = '---\ntitle: "Glycolysis"\ntopic: "Glycolysis"\ngroup: "GraphML"\norder: 1\n---\n';
  var head = 'c0', trees = {}, blobs = {}, nn = 0;
  var serve = function (target) { return target.route('https://api.github.com/**', async function (route) {
    if (S.net === 'down') return route.abort('internetdisconnected');
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '', meth = r.method();
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (S.net === 'refused') return json(401, { message: 'Bad credentials' });
    if (!m) return json(404, {});
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    if (rest === '') return json(200, { permissions: { push: true } });
    // a new map (a copy): the git data calls of own.js toSiteMany, the tree's files written when the branch moves
    if (rest === '/git/ref/heads/main') return json(200, { object: { sha: head } });
    if (/^\/git\/commits\//.test(rest) && meth === 'GET') return json(200, { sha: head, tree: { sha: 't-' + head } });
    if (rest === '/git/blobs' && meth === 'POST') { var bs = 'b' + (++nn); blobs[bs] = Buffer.from(JSON.parse(r.postData()).content, 'base64').toString('utf8'); return json(201, { sha: bs }); }
    if (rest === '/git/trees' && meth === 'POST') { var ts = 'tree' + (++nn); trees[ts] = JSON.parse(r.postData()).tree; return json(201, { sha: ts }); }
    if (rest === '/git/commits' && meth === 'POST') { var cs = 'c' + (++nn); trees[cs] = trees[JSON.parse(r.postData()).tree]; return json(201, { sha: cs }); }
    if (rest === '/git/refs/heads/main') { head = JSON.parse(r.postData()).sha; (trees[head] || []).forEach(function (x) { if (x.sha === null) delete f[x.path]; else f[x.path] = x.content != null ? x.content : blobs[x.sha]; }); return json(200, { object: { sha: head } }); }
    if (rest === '/contents/maps') return json(200, Object.keys(f).filter(function (p) { return /^maps\/[^/]+$/.test(p); }).map(function (p) { return { name: p.slice(5), path: p, type: 'file', sha: gitSha(f[p]) }; }));
    var c = rest.match(/^\/contents\/(.+)$/);
    if (c && meth === 'PUT') {
      var p = decodeURIComponent(c[1]).split('?')[0], d = JSON.parse(r.postData());
      if (f[p] != null && d.sha !== gitSha(f[p])) return json(409, { message: 'test: sha does not match' });
      f[p] = Buffer.from(d.content, 'base64').toString('utf8'); S.puts++;
      return json(200, { content: { sha: gitSha(f[p]) } });
    }
    if (c) {
      var p2 = decodeURIComponent(c[1]).split('?')[0];
      if (f[p2] == null) {
        var mm = /^maps\/([^/]+)$/.exec(p2), pub = mm && !/\.md$/.test(p2) ? await ctx.request.get(new URL('/downloads/' + mm[1], base).href).catch(function () { return null; }) : null;
        if (pub && pub.ok()) f[p2] = await pub.text(); else return json(404, { message: 'Not Found' });
      }
      if (/raw/.test(r.headers().accept || '')) return route.fulfill({ status: 200, contentType: 'text/plain', body: f[p2] });
      return json(200, { sha: gitSha(f[p2]), content: Buffer.from(f[p2]).toString('base64') });
    }
    return json(404, { message: 'Not Found' });
  }); };
  await serve(page);
  var status = function () { return page.$eval('#m2-ed-status', function (s) { return s.classList.contains('m2-ed-warn') ? s.textContent : ''; }).catch(function () { return ''; }); };
  var edLine = function () { return page.$eval('#m2-ed-wait', function (s) { return s.hidden ? '' : s.textContent; }).catch(function () { return ''; }); };
  var listLine = function () { return page.$eval('#m2-list > .m2-wait', function (s) { return s.textContent; }).catch(function () { return ''; }); };
  var cloud = function () { return page.$('#m2-list .m2-map[data-id="' + ID + '"] .m2-cloud').then(function (x) { return !!x; }); };
  var box = function () { return page.evaluate(function () { return new Promise(function (res) { var q = indexedDB.open('atlas-outbox'); q.onupgradeneeded = function () { q.result.createObjectStore('saves'); }; q.onsuccess = function () { var g = q.result.transaction('saves').objectStore('saves').getAll(); g.onsuccess = function () { var o = {}; g.result.forEach(function (r) { o[r.id] = r; }); q.result.close(); res(o); }; }; q.onerror = function () { res({}); }; }); }); };
  var load = async function () {
    await page.goto(base + '#' + ID, { waitUntil: 'load' }).catch(function () {});
    await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000);
  };
  var reload = async function () { await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(4000); };
  var moves = 0;
  var edit = async function () {   // one move on the map open: everything selected and stepped right, the Edit window left open
    if (!(await page.$('#m2-ed-undo:not([disabled])'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-ed-undo:not([disabled])', { state: 'attached', timeout: 30000 }).catch(async function (e) { console.log('   (editing did not start: ' + (await page.$eval('#m2-ed-status', function (x) { return x.textContent; }).catch(function () { return '?'; })) + ' / hash ' + (await page.evaluate(function () { return location.hash; })) + ' / win ' + (await page.$eval('.m2', function (x) { return x.className; }).catch(function () { return '?'; })) + ')'); throw e; }); await page.waitForTimeout(1500);
    await page.mouse.click(1000, 800); await page.keyboard.press('Control+A'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.press('Escape');
    moves++;
  };
  var edit1 = async function () {   // one node moved (clicked, then Shift and the arrow twice); gives its id
    if (!(await page.$('#m2-ed-undo:not([disabled])'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-ed-undo:not([disabled])', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(1500);
    var c = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.left > 300 && r.top > 100 && r.right < 1380 && r.bottom < 880) return [r.left + r.width / 2, r.top + r.height / 2, g.getAttribute('data-n')]; } return null; });
    await page.keyboard.press('Escape'); await page.mouse.click(c[0], c[1]); await page.waitForTimeout(300);
    for (var i = 0; i < 2; i++) { await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(120); }
    await page.waitForTimeout(400); await page.keyboard.press('Escape');
    moves++;
    return c[2];
  };
  var toList = async function () { await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800); };
  var online = function () { return page.evaluate(function () { dispatchEvent(new Event('online')); }); };

  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-token', 'test-token'); localStorage.setItem('atlas-edit-level', 'full'); indexedDB.deleteDatabase('atlas-outbox'); });
  await load();
  await edit(); await page.waitForTimeout(5000);   // made while connected: saved
  var t0 = f[FILE];
  ok('setup: a move made while connected is saved on GitHub', S.puts === 1 && !!t0, 'saves ' + S.puts);
  ok('setup: nothing waits, no line', !(await edLine()) && !Object.keys(await box()).length);

  console.log('# A: a move offline');
  S.net = 'down';
  await edit(); await page.waitForTimeout(5000);
  var k = (await box())[ID];
  ok('A kept in this browser with its text and the version it was made on', !!k && k.text !== t0 && k.sha === gitSha(t0) && k.saved === t0 && k.path === FILE);
  ok('A no red line', !(await status()), await status());
  ok('A the grey line in the Edit window', /^Offline: changes to 1 map kept in this browser, sent to GitHub when the connection is back\.$/.test(await edLine()), await edLine());
  await edit(); await page.waitForTimeout(5000);
  var k2 = (await box())[ID];
  ok('A a second move: kept too, on the same version, the line unchanged', !!k2 && k2.text !== k.text && k2.sha === gitSha(t0) && /changes to 1 map/.test(await edLine()));
  await toList();
  ok('A the list: the line and the cloud by the map', /^Offline: changes to 1 map/.test(await listLine()) && (await cloud()), (await listLine()) + ' / cloud ' + (await cloud()));
  ok('A no pop-up', !S.dialogs.length, S.dialogs.join(' | '));
  S.dialogs.length = 0;

  console.log('# B: reloaded while still offline');
  await reload();
  ok('B still kept', ((await box())[ID] || {}).text === k2.text);
  ok('B the list says it and shows the cloud', /^Offline: changes to 1 map/.test(await listLine()) && (await cloud()), (await listLine()) + ' / cloud ' + (await cloud()));
  ok('B GitHub has not got it', f[FILE] === t0);

  console.log('# C: the connection back');
  S.net = 'up'; await online(); await page.waitForTimeout(3000);
  ok('C GitHub has both moves made offline', f[FILE] === k2.text);
  ok('C nothing waits', !Object.keys(await box()).length);
  ok('C the cloud gone', !(await cloud()));
  ok('C one passing line: sent from the last visit', /^Changes to 1 map from your last visit sent to GitHub\.$/.test(await listLine()), await listLine());
  await page.waitForTimeout(7000);
  ok('C the line gone after a few seconds', !(await listLine()), await listLine());
  ok('C no pop-up, no red (the browser\'s own leave question on the reload is wanted)', !S.dialogs.filter(function (d) { return !/^beforeunload/.test(d); }).length && !(await status()), S.dialogs.join(' | ') + ' ' + (await status()));

  console.log('# D: the file changed on GitHub while offline');
  var copies = function () { return Object.keys(f).filter(function (p) { return /^maps\/.+\.md$/.test(p) && /other version/.test(f[p]); }); };
  var rename = function (t, add, id) { var i = t.indexOf('<y:NodeLabel', id ? t.indexOf('<node id="' + id + '"') : 0), j = t.indexOf('<', t.indexOf('>', i) + 1); return t.slice(0, j) + add + t.slice(j); };   // a node's label (id's, else the first)
  await page.click('#m2-list .m2-map[data-id="' + ID + '"]').catch(function () {}); await page.waitForTimeout(1500);
  S.net = 'down'; await edit(); await page.waitForTimeout(5000);
  var mine = (await box())[ID], KEY = mine && mine.key;
  await reload();   // the page left: the outbox's text is all that holds the reader's move
  await toList();   // the map no longer open in the editor (the map open: tests/save-clash.js)
  f[FILE] = f[FILE].replace('</graphml>', '<!-- changed elsewhere -->\n</graphml>');   // another device's save, of something the reader did not change
  S.net = 'up'; await online(); await page.waitForTimeout(3000);
  ok('D1 changed elsewhere, something else: both joined', !!mine && f[FILE] === mine.text.replace('</graphml>', '<!-- changed elsewhere -->\n</graphml>'));
  ok('D1 silent: no clash said, no copy', !/changed elsewhere/.test(await listLine()) && !copies().length, await listLine());
  ok('D1 nothing waits', !Object.keys(await box()).length);
  await page.click('#m2-list .m2-map[data-id="' + ID + '"]').catch(function () {}); await page.waitForTimeout(1500);
  S.net = 'down'; var nX = await edit1(); await page.waitForTimeout(5000);
  var mine2 = (await box())[ID];
  await reload(); await toList();
  var theirs = rename(f[FILE], ' (renamed elsewhere)', nX);   // the same node renamed elsewhere, which the reader moved
  f[FILE] = theirs;
  S.net = 'up'; await online(); await page.waitForTimeout(6000);
  // (the editor may have opened the version before D1's join, read ahead: the join then brings D1's comment back too)
  var noC = function (t) { return t.replace('<!-- changed elsewhere -->\n', ''); };
  ok('D2 one node changed on both: the reader\'s kept, the rest joined', !!mine2 && noC(f[FILE]) === noC(mine2.text) && f[FILE].indexOf('<!-- changed elsewhere -->') > 0 && f[FILE].indexOf('(renamed elsewhere)') < 0, f[FILE] === theirs ? 'theirs on GitHub' : '');
  var cp2 = copies(), cpFile = cp2.length ? f[cp2[0].replace(/\.md$/, '.graphml')] : null;
  ok('D2 the other version kept as a copy, named so', cp2.length === 1 && cpFile === theirs && /title: "Glycolysis \(other version\)"/.test(f[cp2[0]] || ''), cp2.join(','));
  var dl = 'Glycolysis had also changed elsewhere: the changes are joined, yours kept where both changed the same item; the other version is kept as Glycolysis (other version).';
  ok('D2 said in one grey line', (await listLine()) === dl, await listLine());
  await page.waitForTimeout(7000);
  ok('D2 the line stays until the next move', (await listLine()) === dl, await listLine());
  ok('D2 the copy in the list', (await page.$$eval('#m2-list .m2-map', function (l) { return l.filter(function (e) { return /other version/.test(e.textContent); }).length; })) === 1);
  ok('D2 no red, no pop-up', !(await status()) && !S.dialogs.filter(function (d) { return !/^beforeunload/.test(d); }).length, (await status()) + ' ' + S.dialogs.join(' | '));
  await page.click('#m2-list .m2-map[data-id="' + ID + '"]').catch(function () {}); await page.waitForTimeout(1500);
  await edit(); await page.waitForTimeout(5000);
  ok('D2 the line gone with the next move, which is saved', !(await edLine()) && f[FILE] !== mine2.text, await edLine());
  cp2.forEach(function (p) { delete f[p]; delete f[p.replace(/\.md$/, '.graphml')]; });

  console.log('# K: two machines, a large edit and a small one made on the version before it');
  // the small edit, made on another machine from v0: one node renamed (a node the large edit moves), a comment added; the
  // large one: the whole map moved (taken as a shift of its frame, no change of any node), then that node moved again
  var nK, small = function (v0) { return rename(v0, ' (small edit)', nK).replace('</graphml>', '<!-- small edit -->\n</graphml>'); };
  var keep = function (pg, rec) { return pg.evaluate(function (rec) { return new Promise(function (res) { var q = indexedDB.open('atlas-outbox', 1); q.onupgradeneeded = function () { q.result.createObjectStore('saves'); }; q.onsuccess = function () { var t = q.result.transaction('saves', 'readwrite'); t.objectStore('saves').put(rec, rec.key); t.oncomplete = function () { q.result.close(); res(); }; }; }); }, rec); };
  // order 1: the small edit on GitHub first; the large one, kept here offline, sent after it
  var v0 = f[FILE];
  S.net = 'down'; await edit(); nK = await edit1(); await page.waitForTimeout(5000);
  var large = (await box())[ID];
  await toList();
  f[FILE] = small(v0);
  S.net = 'up'; await online(); await page.waitForTimeout(6000);
  ok('K1 the small edit first, the large here after: the large kept, the small edit\'s comment joined', !!large && f[FILE] === large.text.replace('</graphml>', '<!-- small edit -->\n</graphml>'));
  var k1 = copies();
  ok('K1 the node both changed: the large edit\'s; the small edit kept as the copy', k1.length === 1 && f[k1[0].replace(/\.md$/, '.graphml')] === small(v0) && f[FILE].indexOf('(small edit)') < 0, k1.join(','));
  k1.forEach(function (p) { delete f[p]; delete f[p.replace(/\.md$/, '.graphml')]; });
  // order 2: the large edit saved here first; the small one, waiting on another machine (a second browser), sent after
  await page.click('#m2-list .m2-map[data-id="' + ID + '"]').catch(function () {}); await page.waitForTimeout(1500);
  var w0 = f[FILE];
  await edit(); nK = await edit1(); await page.waitForTimeout(5000);
  var big = f[FILE];
  await toList();
  var ctx2 = await b.newContext({ viewport: { width: 1400, height: 900 } }), p2 = await ctx2.newPage();
  p2.on('pageerror', function (e) { S.errs.push('machine 2: ' + e.message); });
  if (local) { await p2.route(/\/styles\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); }); }
  await serve(p2);
  await p2.goto(base, { waitUntil: 'load' });
  await p2.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-token', 'test-token'); localStorage.setItem('atlas-edit-level', 'full'); });
  await keep(p2, { key: KEY, id: ID, path: FILE, name: 'Glycolysis', text: small(w0), sha: gitSha(w0), saved: w0, also: null, mine: false, at: Date.now() });
  await p2.reload({ waitUntil: 'load' }); await p2.waitForTimeout(8000);   // the page opening sends what waits
  ok('K2 the large edit first, the small one from the other machine after: the large kept outside the node both changed', big !== w0 && f[FILE].indexOf('(small edit)') > 0 && f[FILE].indexOf('<!-- small edit -->') > 0, f[FILE] === big ? 'the large edit alone' : '');
  var k2 = copies();
  ok('K2 the large edit kept as the copy on that machine', k2.length === 1 && f[k2[0].replace(/\.md$/, '.graphml')] === big, k2.join(','));
  ok('K2 that machine says it', /^Glycolysis had also changed elsewhere: the changes are joined, yours kept where both changed the same item; the other version is kept as Glycolysis \(other version\)\.$/.test(await p2.$eval('#m2-list > .m2-wait', function (s) { return s.textContent; }).catch(function () { return ''; })));
  k2.forEach(function (p) { delete f[p]; delete f[p.replace(/\.md$/, '.graphml')]; });
  await ctx2.close();

  console.log('# E: the token refused');
  await page.click('#m2-list .m2-map[data-id="' + ID + '"]').catch(function () {}); await page.waitForTimeout(1500);
  await edit(); await page.waitForTimeout(5000);   // editing started while GitHub answers
  S.net = 'refused'; var p0 = f[FILE];
  await edit(); await page.waitForTimeout(5000);
  ok('E said once, in the Edit window', /^GitHub refused the token\. Your changes are kept in this browser\. Connect again with a new token\.$/.test(await status()), await status());
  var ke = (await box())[ID];
  ok('E kept', !!ke && f[FILE] === p0);
  ok('E no offline line (not a connection)', !(await edLine()), await edLine());

  console.log('# F: reloaded with GitHub answering again');
  S.net = 'up'; await reload();
  ok('F sent at once on opening', !Object.keys(await box()).length && !!ke && f[FILE] === ke.text);
  await page.click('#m2-list .m2-map[data-id="' + ID + '"]').catch(function () {}); await page.waitForTimeout(1500);
  var p1 = f[FILE];
  await edit(); await page.waitForTimeout(5000);
  ok('F editing goes on from GitHub\'s version: the next move saved, no clash', f[FILE] !== p1 && !(await status()) && !(await listLine()), (await status()) + ' ' + (await listLine()));

  console.log('# G: the map open in the editor when the connection comes back');
  S.net = 'down'; await edit(); await page.waitForTimeout(5000);
  var kg = (await box())[ID];
  ok('G kept while open', !!kg && f[FILE] !== kg.text && /^Offline/.test(await edLine()));
  S.net = 'up'; await online(); await page.waitForTimeout(3000);
  ok('G sent on the connection\'s return, the line gone', !!kg && f[FILE] === kg.text && !Object.keys(await box()).length && !(await edLine()), await edLine());

  console.log('# I: another tab kept a newer text of the waiting map');
  S.net = 'down'; await edit(); await page.waitForTimeout(5000);
  await toList(); await page.waitForTimeout(1500);
  var ki = (await box())[ID], newer = ki ? ki.text.replace('</graphml>', '<!-- the other tab -->\n</graphml>') : '';
  await page.evaluate(function (a) { return new Promise(function (res) { var q = indexedDB.open('atlas-outbox'); q.onsuccess = function () { var r = Object.assign({}, a.r, { text: a.t, at: Date.now() + 1000 }); var t = q.result.transaction('saves', 'readwrite'); t.objectStore('saves').put(r, r.key); t.oncomplete = function () { q.result.close(); res(); }; }; }); }, { r: ki, t: newer });
  S.net = 'up'; await online(); await page.waitForTimeout(3000);
  ok('I the newer text sent, not this tab\'s older one, and no clash claimed', !!ki && f[FILE] === newer && !/changed elsewhere/.test(await listLine()), await listLine());
  ok('I nothing waits', !Object.keys(await box()).length);

  console.log('# J: the token refused, then pasted again in the Edit window');
  await page.click('#m2-list .m2-map[data-id="' + ID + '"]').catch(function () {}); await page.waitForTimeout(1500);
  await edit(); await page.waitForTimeout(4000);
  S.net = 'refused'; await edit(); await page.waitForTimeout(5000);
  var kj = (await box())[ID];
  ok('J kept while refused', !!kj && f[FILE] !== kj.text);
  S.net = 'up';
  await page.fill('#m2-ed-gh-token', 'test-token').catch(function () {}); await page.click('#m2-ed-gh-go').catch(function () {}); await page.waitForTimeout(5000);
  ok('J sent once the token is taken, the cloud gone', !!kj && f[FILE] === kj.text && !Object.keys(await box()).length && !(await cloud()), await status());

  console.log('# H: no token, a site map edited offline, the connection back');
  var puts0 = S.puts;
  await page.evaluate(function () { localStorage.removeItem('atlas-edit-token'); });
  await reload();
  await page.click('#m2-list .m2-map[data-id="' + ID + '"]').catch(function () {}); await page.waitForTimeout(1500);
  S.net = 'down'; await edit(); await page.waitForTimeout(3000);
  S.net = 'up'; await online(); await page.waitForTimeout(3000);
  ok('H nothing sent to GitHub, no file named null, no red line', S.puts === puts0 && !('maps/null' in f) && !(await status()), (S.puts - puts0) + ' saves; ' + (await status()));

  ok('no page errors', !S.errs.length, S.errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.log('WRONG ' + e.stack); process.exit(1); });
