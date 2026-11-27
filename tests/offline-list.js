// The list's outbox (editor/src/own.js opSend, opsDrain; outbox.js store ops): with a token, a change made in the list
// (Rename map, Move to, Delete map, Rename group, Delete forever) is kept in this browser before it is sent, so a lost
// connection says no pop-up, the list keeps showing the change (also after a reload), one grey line and a cloud say it
// waits, and it goes to GitHub in the order made when the connection is back. GitHub is played by this script.
//   node tests/offline-list.js [base address] [--local]
// --local: the editor of the working tree routed into the live page.
// Parts: A three changes offline; B a reload offline keeps them; C the connection back sends them in order; D a group
// renamed offline; E Delete forever offline, kept through a reload; F the token refused; G a change GitHub refuses
// when sent later (its page gone meanwhile): let go, the list back as GitHub has it; H with nothing waiting, no line.
var { chromium } = require('playwright'), crypto = require('crypto'), path = require('path');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0;
var base = args.filter(function (a) { return a[0] !== '-'; })[0] || 'https://viewer-source.github.io/styles/';
var here = path.join(__dirname, '..');
var gitSha = function (t) { var b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex'); };
var bad = 0;
function ok(what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); }
var GLY = 'glycolysis-graphml', MUS = 'glycogen-muscle-graphml', LIV = 'glycogen-liver-graphml';
(async function () {
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage();
  var S = { net: 'up', dialogs: [], errs: [], files: {}, blobs: {}, trees: {}, commits: 0, writes: [] }, f = S.files;
  page.on('pageerror', function (e) { S.errs.push(e.message); });
  page.on('dialog', function (d) { S.dialogs.push(d.message().replace(/\s+/g, ' ')); d.accept().catch(function () {}); });
  if (local) {
    var ed = require('./editor-now.js')(here);
    await page.route(/\/styles\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
  }
  var pages = function () {
    f['maps/' + GLY + '.md'] = '---\ntitle: "Glycolysis"\ntopic: "Glycolysis"\ngroup: "GraphML"\norder: 1\n---\n';
    f['maps/' + MUS + '.md'] = '---\ntitle: "Glycogen metabolism (muscle)"\ntopic: "Glycogen metabolism (muscle)"\ngroup: "GraphML"\norder: 3\n---\n';
    f['maps/' + LIV + '.md'] = '---\ntitle: "Glycogen metabolism (liver)"\ntopic: "Glycogen metabolism (liver)"\ngroup: "GraphML"\norder: 4\n---\n';
  };
  pages();
  await page.route('https://api.github.com/**', async function (route) {
    if (S.net === 'down') return route.abort('internetdisconnected');
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '', meth = r.method();
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (S.net === 'refused') return json(401, { message: 'Bad credentials' });
    if (!m) return json(404, {});
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    if (rest === '') return json(200, { permissions: { push: true } });
    if (meth !== 'GET') S.writes.push(meth + ' ' + rest.split('?')[0]);
    if (rest.split('?')[0] === '/contents/maps') return json(200, Object.keys(f).filter(function (p) { return /^maps\/[^/]+$/.test(p); }).map(function (p) { return { name: p.slice(5), path: p, type: 'file', sha: gitSha(f[p]) }; }));
    if (rest === '/git/blobs' && meth === 'POST') { var t = Buffer.from(JSON.parse(r.postData()).content, 'base64').toString('utf8'), s = gitSha(t); S.blobs[s] = t; return json(201, { sha: s }); }
    if (rest === '/git/ref/heads/main') return json(200, { object: { sha: 'c' + S.commits } });
    if (/^\/git\/commits\/c\d+$/.test(rest)) return json(200, { tree: { sha: 't' + S.commits } });
    if (rest === '/git/trees' && meth === 'POST') { var id = 'n' + Object.keys(S.trees).length; S.trees[id] = JSON.parse(r.postData()).tree; return json(201, { sha: id }); }
    if (rest === '/git/commits' && meth === 'POST') { var d0 = JSON.parse(r.postData()); S.trees['c:' + (S.commits + 1)] = S.trees[d0.tree]; return json(201, { sha: 'c' + (S.commits + 1) }); }
    if (rest === '/git/refs/heads/main' && meth === 'PATCH') {
      S.commits++; (S.trees['c:' + S.commits] || []).forEach(function (e) { if (e.sha === null) delete f[e.path]; else f[e.path] = e.content != null ? e.content : S.blobs[e.sha]; });
      return json(200, {});
    }
    var c = rest.match(/^\/contents\/(.+)$/);
    if (c && meth === 'PUT') {
      var p = decodeURIComponent(c[1]).split('?')[0], d = JSON.parse(r.postData());
      if (f[p] != null && d.sha && d.sha !== gitSha(f[p])) return json(409, { message: 'test: sha does not match' });
      f[p] = Buffer.from(d.content, 'base64').toString('utf8');
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
  });
  await page.route('**/index.json*', async function (route) {   // the site's list as the test's GitHub has it before any change (no build runs)
    var res = await route.fetch(), list = JSON.parse(await res.text());
    list.forEach(function (m) { m.deleted = ''; if (/^maps\/.+\//.test(m.editPath || '')) m.pageless = true; });
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) });
  });
  var listSel = function (id) { return '#m2-list .m2-map[data-id="' + id + '"]'; };
  var toList = async function () { if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]'); await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 }); };
  var menu = async function (sel, item) {
    await toList();
    await page.click(sel, { button: 'right' }); await page.waitForTimeout(300);
    var btn = await page.$('.m2-cx button:text-is("' + item + '")');
    if (!btn) { var have = await page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); await page.keyboard.press('Escape'); throw new Error('no item ' + item + ' (' + have.join(' / ') + ')'); }
    await btn.click(); await page.waitForTimeout(400);
  };
  var typeIn = async function (v) { await page.waitForTimeout(300); await page.keyboard.press('Control+A'); await page.keyboard.type(v); await page.keyboard.press('Enter'); await page.waitForTimeout(1500); };
  var nameOf = function (id) { return page.$eval(listSel(id) + ' .m2-name', function (x) { return x.textContent.trim(); }).catch(function () { return page.$eval('#m2-list .m2-map[data-id="' + id + '"]', function (x) { return x.textContent.trim(); }).catch(function () { return '(gone)'; }); }); };
  var binned = function (id) { return page.$('#m2-list .m2-binned[data-id="' + id + '"]').then(function (x) { return !!x; }); };
  var shown = function (id) { return page.$(listSel(id)).then(function (x) { return !!x; }); };
  var groupOf = function (id) { return page.$eval(listSel(id) + ':not(.m2-binned)', function (x) { var g = x.previousElementSibling; while (g && !g.classList.contains('m2-group') && !g.classList.contains('m2-bin')) g = g.previousElementSibling; return g ? (g.getAttribute('data-group') || g.textContent.trim()) : '(top)'; }).catch(function () { return '(gone)'; }); };
  var cloud = function (id) { return page.$(listSel(id) + ' .m2-cloud').then(function (x) { return !!x; }); };
  var line = function () { return page.$eval('#m2-list > .m2-wait', function (s) { return s.textContent; }).catch(function () { return ''; }); };
  var red = function () { return page.$eval('#m2-ed-status', function (s) { return s.classList.contains('m2-ed-warn') ? s.textContent : ''; }).catch(function () { return ''; }); };
  var ops = function () { return page.evaluate(function () { return new Promise(function (res) { var q = indexedDB.open('atlas-ops', 1); q.onupgradeneeded = function () { q.result.createObjectStore('ops', { keyPath: 'seq', autoIncrement: true }); }; q.onsuccess = function () { var d = q.result; if (!d.objectStoreNames.contains('ops')) { d.close(); return res([]); } var g = d.transaction('ops').objectStore('ops').getAll(); g.onsuccess = function () { d.close(); res(g.result.map(function (o) { return o.kind + ':' + (o.ids || []).join(','); })); }; }; q.onerror = function () { res([]); }; }); }); };
  var fm = function (id, k) { var x = (f['maps/' + id + '.md'] || '').match(new RegExp('^' + k + ':[ \\t]*([^\\n]*)', 'm')); return x ? x[1].replace(/^"(.*)"$/, '$1') : null; };
  var load = async function (h) {
    await page.goto(base + '#' + (h || GLY), { waitUntil: 'load' }); await page.reload({ waitUntil: 'load' });   // a goto to the same address is no new page
    await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3500);
  };
  var online = async function () { await page.evaluate(function () { dispatchEvent(new Event('online')); }); await page.waitForTimeout(5000); };
  var fresh = async function () { pages(); await page.evaluate(function () { var t = localStorage.getItem('atlas-edit-token'); localStorage.clear(); localStorage.setItem('atlas-edit-token', t || 'test-token'); }); };   // the test's earlier parts left behind (the reader's order, held states)
  var openBin = async function () { var h = await page.$eval('#m2-list .m2-bin', function (h) { return h.classList.contains('m2-shut'); }).catch(function () { return false; }); if (h) { await page.click('#m2-list .m2-bin'); await page.waitForTimeout(300); } };

  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-token', 'test-token'); indexedDB.deleteDatabase('atlas-outbox'); indexedDB.deleteDatabase('atlas-ops'); });
  await load(); await toList();
  var musGroup0 = await groupOf(MUS);

  console.log('# A: three changes with GitHub cut off');
  S.net = 'down'; S.dialogs.length = 0;
  await menu(listSel(GLY), 'Rename map'); await typeIn('Glycolysis X');
  await menu(listSel(MUS), 'Move to...'); var opts = await page.$$('.m2-cx button:not([disabled])'), to = (await opts[opts.length - 1].textContent()).trim(); await opts[opts.length - 1].click(); await page.waitForTimeout(1500);
  await menu(listSel(LIV), 'Delete map'); await page.waitForTimeout(2500);
  ok('A no pop-up', !S.dialogs.length, S.dialogs.join(' || '));
  ok('A no red line', !(await red()), await red());
  ok('A renamed in the list', (await nameOf(GLY)).indexOf('Glycolysis X') >= 0, await nameOf(GLY));
  ok('A moved in the list', (await groupOf(MUS)) === to, (await groupOf(MUS)) + ' (to ' + to + ')');
  await openBin();
  ok('A in Deleted', await binned(LIV));
  var o = await ops();
  ok('A three changes kept in order', o.join(' ') === 'front:' + GLY + ' front:' + MUS + ' front:' + LIV, o.join(' '));
  if (process.env.DEBUG) console.log('   first: ' + (await page.$eval('#m2-list', function (l) { return l.firstElementChild.outerHTML.slice(0, 300); })) + ' / wait: ' + (await page.$$eval('.m2-wait, #m2-ed-wait', function (l) { return l.map(function (x) { return x.id + ':' + x.className + ':' + x.textContent.slice(0, 80); }).join(' | '); })) + ' / errs ' + S.errs.join(' | '));
  ok('A the grey line counts three maps', /^Offline: changes to 3 maps kept in this browser/.test(await line()), await line());
  ok('A a cloud by each', (await cloud(GLY)) && (await cloud(MUS)), 'gly ' + (await cloud(GLY)) + ', mus ' + (await cloud(MUS)));
  ok('A nothing reached GitHub', fm(GLY, 'topic') === 'Glycolysis' && fm(LIV, 'deleted') === null);

  console.log('# B: a reload with GitHub still cut off');
  await load(); await toList(); await openBin();
  ok('B no pop-up', !S.dialogs.length, S.dialogs.join(' || '));
  ok('B still renamed', (await nameOf(GLY)).indexOf('Glycolysis X') >= 0, await nameOf(GLY));
  ok('B still moved', (await groupOf(MUS)) === to, await groupOf(MUS));
  ok('B still in Deleted', await binned(LIV));
  ok('B still kept', (await ops()).length === 3, (await ops()).join(' '));
  ok('B the grey line', /^Offline: changes to 3 maps/.test(await line()), await line());

  console.log('# C: the connection back');
  S.net = 'up'; S.writes.length = 0; await online();
  ok('C sent in the order made', S.writes.join(' ') === ['PUT /contents/maps/' + GLY + '.md', 'PUT /contents/maps/' + MUS + '.md', 'PUT /contents/maps/' + LIV + '.md'].join(' '), S.writes.join(' '));
  ok('C GitHub has the name', fm(GLY, 'topic') === 'Glycolysis X' && fm(GLY, 'title') === 'Glycolysis X', fm(GLY, 'topic'));
  ok('C GitHub has the move', fm(MUS, 'group') === to, fm(MUS, 'group'));
  ok('C GitHub has the delete', !!fm(LIV, 'deleted'), fm(LIV, 'deleted'));
  ok('C nothing left kept', !(await ops()).length, (await ops()).join(' '));
  ok('C no offline line', !/^Offline/.test(await line()), await line());
  ok('C clouds gone', !(await cloud(GLY)) && !(await cloud(MUS)));
  if (process.env.DEBUG) console.log('   C line: ' + (await line()) + ' / ed ' + (await page.$eval('#m2-ed-wait', function (s) { return s.hidden + ':' + s.textContent; }).catch(function () { return '?'; })));
  ok('C said once as sent', /from your last visit sent to GitHub/.test(await line()), await line());
  ok('C still renamed in the list', (await nameOf(GLY)).indexOf('Glycolysis X') >= 0);

  console.log('# D: a group renamed offline');
  await fresh();
  await load(); await toList();
  if (process.env.DEBUG) console.log('   D start: mus in ' + (await groupOf(MUS)) + ', moved ' + (await page.evaluate(function () { return localStorage.getItem('atlas-moved:' + location.pathname); })));
  S.net = 'down'; S.dialogs.length = 0;
  var gsel = '#m2-list .m2-group[data-group="GraphML"]';
  var hasGroup = !!(await page.$(gsel));
  if (!hasGroup) ok('D the group GraphML in the list', false, await page.$$eval('#m2-list .m2-group', function (l) { return l.map(function (x) { return x.getAttribute('data-group'); }).join(' / '); }));
  else {
    await menu(gsel, 'Rename group'); await typeIn('GraphML Y');
    ok('D no pop-up', !S.dialogs.length, S.dialogs.join(' || '));
    ok('D renamed in the list', !!(await page.$('#m2-list .m2-group[data-group="GraphML Y"]')));
    ok('D kept', (await ops()).some(function (x) { return /^group:/.test(x); }), (await ops()).join(' '));
    S.net = 'up'; await online();
    ok('D GitHub has the group', fm(GLY, 'group') === 'GraphML Y' && fm(MUS, 'group') === 'GraphML Y', fm(GLY, 'group') + ' / ' + fm(MUS, 'group'));
    ok('D nothing left kept', !(await ops()).length);
  }

  console.log('# E: Delete forever offline');
  await fresh();
  S.net = 'up'; await load(); await toList();
  await openBin();
  if (!(await binned(LIV))) { await menu(listSel(LIV), 'Delete map'); await page.waitForTimeout(2500); await openBin(); }   // into Deleted while up
  S.net = 'down'; S.dialogs.length = 0;
  await menu('#m2-list .m2-binned[data-id="' + LIV + '"]', 'Delete forever'); await page.waitForTimeout(2500);
  ok('E no pop-up', !S.dialogs.length, S.dialogs.join(' || '));
  ok('E gone from the list', !(await shown(LIV)));
  ok('E kept', (await ops()).some(function (x) { return x === 'erase:' + LIV; }), (await ops()).join(' '));
  await load(); await toList(); await openBin();
  ok('E still gone after a reload', !(await shown(LIV)));
  S.net = 'up'; await online();
  ok('E GitHub has it gone', f['maps/' + LIV + '.md'] == null);
  ok('E nothing left kept', !(await ops()).length, (await ops()).join(' '));

  console.log('# F: the token refused');
  await fresh();
  await load(); await toList();
  S.net = 'refused'; S.dialogs.length = 0;
  await menu(listSel(GLY), 'Rename map'); await typeIn('Glycolysis Z');
  ok('F no pop-up', !S.dialogs.length, S.dialogs.join(' || '));
  ok('F kept', (await ops()).length === 1, (await ops()).join(' '));
  ok('F renamed in the list', (await nameOf(GLY)).indexOf('Glycolysis Z') >= 0, await nameOf(GLY));
  S.net = 'up'; await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token-2'); });
  S.writes.length = 0; await load();
  if (process.env.DEBUG) console.log('   F: writes ' + S.writes.join(' ') + ' / ops ' + (await ops()).join(' ') + ' / line ' + (await line()) + ' / red ' + (await red()) + ' / ' + S.dialogs.join(' || '));
  ok('F sent with the token back', fm(GLY, 'topic') === 'Glycolysis Z', fm(GLY, 'topic'));
  ok('F nothing left kept', !(await ops()).length);

  console.log('# G: refused when sent later');
  await fresh(); await load(); await toList();
  S.net = 'down'; S.dialogs.length = 0;
  await menu(listSel(MUS), 'Rename map'); await typeIn('Muscle renamed');
  delete f['maps/' + MUS + '.md'];   // its page gone on GitHub meanwhile
  S.net = 'up'; await online();
  ok('G said once', S.dialogs.length === 1 && /Not changed on GitHub/.test(S.dialogs[0]), S.dialogs.join(' || '));
  ok('G let go', !(await ops()).length, (await ops()).join(' '));
  ok('G the list back', (await nameOf(MUS)).indexOf('Muscle renamed') < 0, await nameOf(MUS));

  console.log('# H: nothing waiting');
  await fresh(); S.dialogs.length = 0; await load(); await toList();
  ok('H no line', !(await line()), await line());
  ok('H no page errors', !S.errs.length, S.errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
