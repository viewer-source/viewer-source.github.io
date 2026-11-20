// The list's right-click menu on a map (own.js listItems) and maps moved between groups, on the styles page.
//   No token (GitHub answers 404; the reader's maps in this browser):
//   1. On a reader's own map: Rename map, Make a copy, Move to... first, in that order; Delete map the menu's last line,
//      under a line of its own.
//   2. Make a copy of it: Copy of <name>, the row right under the original, the copy opened (the address its id), no
//      name field open.
//   3. Make a copy of a site map (GraphML): Copy of <its name>, right under the original, opened.
//   4. A reader's own map dragged by its name onto a map of a site group: in that group; after a reload too.
//   5. A site map dragged by its name onto a map of another group: in that group; after a reload too (kept in this
//      browser).
//   With a token (GitHub played by this script: a repository in memory, blob shas as git makes them):
//   6. On a site map with a page: Rename map, Make a copy, Move to... first; Delete map last, under a line.
//   7. A site map dragged into another group: its maps/<id>.md written with that group (the move on the site).
//   8. Move to... another group: its page's group written too, the map first in that group in the list.
//   No script error, no dialog.
//   node tests/list-map-menu.js [base address]
var { chromium } = require('playwright'), crypto = require('crypto');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
var gitSha = function (t) { var b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex'); };
(async function () {
  var b = await chromium.launch(), errs = [], dialogs = [], bad = 0;
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var mk = async function () {
    var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage();
    page.on('pageerror', function (e) { errs.push(e.message); });
    page.on('dialog', function (d) { dialogs.push(d.message()); d.accept().catch(function () {}); });
    return page;
  };
  var H = function (page) {
    var o = {};
    o.list = async function () { if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]'); await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 }); };
    o.load = async function (h) {
      await page.goto('about:blank'); await page.goto(base + '#' + h, { waitUntil: 'load' });
      await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000); await o.list();
    };
    o.menuOf = async function (sel) {   // the menu's lines: names, '|' for a line
      await o.list(); await page.click(sel, { button: 'right' }); await page.waitForTimeout(300);
      var l = await page.$$eval('.m2-cx[role="menu"] > *', function (l) { return l.map(function (x) { return x.tagName === 'BUTTON' ? x.textContent.trim() : '|'; }); });
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      return l;
    };
    o.menu = async function (sel, item) { await o.list(); await page.click(sel, { button: 'right' }); await page.waitForTimeout(300); await page.click('.m2-cx button:text-is("' + item + '")'); await page.waitForTimeout(2000); };
    o.ids = function () { return page.$$eval('#m2-list .m2-map:not(.m2-binned)', function (l) { return l.map(function (x) { return x.dataset.id; }); }); };
    o.row = function (id) { return page.$eval('#m2-list .m2-map[data-id="' + id + '"]', function (x) { return [x.querySelector('.m2-name').textContent, x.dataset.group || '']; }).catch(function () { return null; }); };
    o.hash = function () { return page.evaluate(function () { return decodeURIComponent(location.hash.slice(1)); }); };
    o.toList = async function () { await page.keyboard.press('Escape'); await page.click('.m2-ri[data-win="list"]').catch(function () {}); await page.waitForTimeout(800); if (await page.$('.m2-editing')) { await page.click('.m2-ri[data-win="edit"]').catch(function () {}); await page.waitForTimeout(800); await page.click('.m2-ri[data-win="list"]').catch(function () {}); await page.waitForTimeout(800); } await o.list(); };
    o.drag = async function (id, onto) {   // a map pressed on its name and dropped on the upper part of another map's row
      await page.$eval('#m2-list', function (x) { x.scrollTop = 0; });
      var src = await page.$('#m2-list .m2-map[data-id="' + id + '"] .m2-name'); await src.scrollIntoViewIfNeeded();
      var s = await src.boundingBox(), t = await (await page.$('#m2-list .m2-map[data-id="' + onto + '"]')).boundingBox();
      if (!t || t.y < 0 || t.y > 880) { var d = await page.$('#m2-list .m2-map[data-id="' + onto + '"]'); await d.scrollIntoViewIfNeeded(); t = await d.boundingBox(); s = await (await page.$('#m2-list .m2-map[data-id="' + id + '"] .m2-name')).boundingBox(); }
      await page.mouse.move(s.x + 5, s.y + s.height / 2); await page.mouse.down();
      await page.mouse.move(s.x + 5, t.y + t.height * 0.3, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(2000);
    };
    return o;
  };
  // the site's maps, two groups to move between
  var site = function (page) { return page.$$eval('#m2-list .m2-map:not(.m2-binned):not(.m2-mine)', function (l) { return l.map(function (x) { return [x.dataset.id, x.dataset.group || '', x.querySelector('.m2-name').textContent]; }); }); };

  // without a token
  var page = await mk(), o = H(page);
  await page.route('https://api.github.com/**', function (r) { r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }); });
  await o.load('acly-graphml');
  await o.menu('#m2-list .m2-map >> nth=0', 'New SBGN-ML map'); var a = await o.hash(); await o.toList();
  var M = await o.menuOf('#m2-list .m2-map[data-id="' + a + '"]');
  ok('1. own map: Rename map, Make a copy, Move to... first', M.slice(0, 3).join() === 'Rename map,Make a copy,Move to...', M.join(' / '));
  ok('1. Delete map the last line, under a line of its own', M[M.length - 1] === 'Delete map' && M[M.length - 2] === '|' && M.indexOf('Delete map') === M.length - 1, M.join(' / '));
  var n0 = (await o.row(a))[0];
  await o.menu('#m2-list .m2-map[data-id="' + a + '"]', 'Make a copy');
  var cp = await o.hash(), I = await o.ids();
  ok('2. Make a copy: the copy opened', cp !== a && I.indexOf(cp) >= 0, a + ' -> ' + cp);
  ok('2. named Copy of <name>', ((await o.row(cp)) || [])[0] === 'Copy of ' + n0, JSON.stringify(await o.row(cp)));
  ok('2. right under the original', I.indexOf(cp) === I.indexOf(a) + 1, I.slice(0, 5).join());
  ok('2. no name field open', !(await page.$('#m2-list input.m2-map-edit')));
  await o.toList();
  var S = await site(page), sm = S.filter(function (x) { return /-graphml$/.test(x[0]); })[0];
  await o.menu('#m2-list .m2-map[data-id="' + sm[0] + '"]', 'Make a copy');
  var cp2 = await o.hash(); I = await o.ids();
  ok('3. a site map copied: Copy of <its name>, opened', cp2 !== sm[0] && ((await o.row(cp2)) || [])[0] === 'Copy of ' + sm[2], cp2 + ' ' + JSON.stringify(await o.row(cp2)));
  ok('3. right under the original', I.indexOf(cp2) === I.indexOf(sm[0]) + 1, I.indexOf(sm[0]) + ' ' + I.indexOf(cp2));
  await o.toList();
  // 4. the own map dragged onto a site map of a site group
  S = await site(page);
  var tgt = S.filter(function (x) { return x[1] && x[1] !== sm[1]; })[0];
  await o.drag(a, tgt[0]);
  ok('4. own map dragged into the site group ' + tgt[1], ((await o.row(a)) || [])[1] === tgt[1], JSON.stringify(await o.row(a)));
  // 5. a site map dragged into another group
  S = await site(page);
  var g0 = S[0][1], mover = S.filter(function (x) { return x[1] && x[1] !== g0; })[1] || S.filter(function (x) { return x[1] !== g0; })[0];
  await o.drag(mover[0], S[0][0]);
  ok('5. site map dragged into ' + g0, ((await o.row(mover[0])) || [])[1] === g0, mover[1] + ' -> ' + JSON.stringify(await o.row(mover[0])));
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(4000); await o.list();
  ok('4. after a reload: still in ' + tgt[1], ((await o.row(a)) || [])[1] === tgt[1], JSON.stringify(await o.row(a)));
  ok('5. after a reload: still in ' + g0, ((await o.row(mover[0])) || [])[1] === g0, JSON.stringify(await o.row(mover[0])));
  await page.context().close();

  // with a token, GitHub played by the script
  page = await mk(); o = H(page);
  var files = {}, blobs = {}, trees = {}, commits = 0, puts = [], SID = null;
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '', meth = r.method();
    var json = function (s, x) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(x) }); };
    if (!m) return json(404, {});
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    if (rest === '') return json(200, { permissions: { push: true } });
    if (rest === '/contents/maps') return json(200, Object.keys(files).filter(function (p) { return /^maps\/[^/]+$/.test(p); }).map(function (p) { return { name: p.slice(5), path: p, type: 'file' }; }));
    if (rest === '/git/blobs' && meth === 'POST') { var t = Buffer.from(JSON.parse(r.postData()).content, 'base64').toString('utf8'), s = gitSha(t); blobs[s] = t; return json(201, { sha: s }); }
    if (rest === '/git/ref/heads/main') return json(200, { object: { sha: 'c' + commits } });
    if (/^\/git\/commits\/c\d+$/.test(rest)) return json(200, { tree: { sha: 't' + commits } });
    if (rest === '/git/trees' && meth === 'POST') { var id = 'n' + Object.keys(trees).length; trees[id] = JSON.parse(r.postData()).tree; return json(201, { sha: id }); }
    if (rest === '/git/commits' && meth === 'POST') { var d0 = JSON.parse(r.postData()); trees['c:' + (commits + 1)] = trees[d0.tree]; return json(201, { sha: 'c' + (commits + 1) }); }
    if (rest === '/git/refs/heads/main' && meth === 'PATCH') { commits++; (trees['c:' + commits] || []).forEach(function (e) { puts.push(e.path); if (e.sha === null) delete files[e.path]; else files[e.path] = e.content != null ? e.content : blobs[e.sha]; }); return json(200, {}); }
    var c = rest.match(/^\/contents\/(.+)$/);
    if (c && meth === 'PUT') { var p = decodeURIComponent(c[1]), d = JSON.parse(r.postData()); puts.push(p); if (files[p] != null && d.sha !== gitSha(files[p])) return json(409, { message: 'sha does not match' }); files[p] = Buffer.from(d.content, 'base64').toString('utf8'); return json(200, { content: { sha: gitSha(files[p]) } }); }
    if (c) { var p2 = decodeURIComponent(c[1]); if (files[p2] == null) return json(404, { message: 'Not Found' }); return json(200, { sha: gitSha(files[p2]), content: Buffer.from(files[p2]).toString('base64') }); }
    return json(404, { message: 'Not Found' });
  });
  await page.goto(base, { waitUntil: 'load' }); await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); });
  await o.load('acly-graphml');
  S = await site(page);
  // two site maps with a page (held by the script's repository), of different groups
  var p1 = S.filter(function (x) { return /-graphml$/.test(x[0]) && x[1]; })[0], p2 = S.filter(function (x) { return x[1] && x[1] !== p1[1]; })[0];
  [p1, p2].forEach(function (x) { files['maps/' + x[0] + '.md'] = '---\ntitle: "' + x[2] + '"\ntopic: "' + x[2] + '"\ngroup: "' + x[1] + '"\norder: 5\n---\nIts text.\n'; });
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(4000); await o.list();
  M = await o.menuOf('#m2-list .m2-map[data-id="' + p1[0] + '"]');
  ok('6. site map with a token: Rename map, Make a copy, Move to... first', M.slice(0, 3).join() === 'Rename map,Make a copy,Move to...', M.join(' / '));
  ok('6. Delete map the last line, under a line of its own', M[M.length - 1] === 'Delete map' && M[M.length - 2] === '|', M.join(' / '));
  puts = [];
  await o.drag(p1[0], p2[0]); await page.waitForTimeout(2000);
  var g7 = (files['maps/' + p1[0] + '.md'].match(/^group: "(.*)"$/m) || [])[1];
  ok('7. dragged into ' + p2[1] + ': in that group in the list', ((await o.row(p1[0])) || [])[1] === p2[1], JSON.stringify(await o.row(p1[0])));
  ok('7. and its page written with that group', puts.indexOf('maps/' + p1[0] + '.md') >= 0 && g7 === p2[1], puts.join() + ' group ' + g7);
  puts = [];
  await o.menu('#m2-list .m2-map[data-id="' + p1[0] + '"]', 'Move to...'); await page.click('.m2-cx button:text-is("' + p1[1] + '")'); await page.waitForTimeout(3000);
  var g8 = (files['maps/' + p1[0] + '.md'].match(/^group: "(.*)"$/m) || [])[1];
  var first8 = await page.$$eval('#m2-list .m2-map:not(.m2-binned)', function (l, g) { return l.filter(function (x) { return (x.dataset.group || '') === g; }).map(function (x) { return x.dataset.id; })[0]; }, p1[1]);
  ok('8. Move to... back to ' + p1[1] + ': its page written with that group', puts.indexOf('maps/' + p1[0] + '.md') >= 0 && g8 === p1[1], puts.join() + ' group ' + g8);
  ok('8. first in that group in the list', first8 === p1[0], first8);
  ok('no dialog', !dialogs.length, dialogs.join(' | '));
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
