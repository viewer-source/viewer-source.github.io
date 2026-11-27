// Every list action and a save tried with the connection gone, to measure what each does and says (a probe: it prints,
// it does not judge). GitHub is played by this script (page.route on api.github.com, a repository in memory); "down"
// fails every request to it as a lost connection would (route.abort), "refused" answers 401. Part T: with a token.
// Part F: no token, a folder (the browser's private file system), the whole browser offline (context.setOffline).
//   node tests/offline-probe.js [base address] [T|F]
var { chromium } = require('playwright'), crypto = require('crypto');
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/styles/';
var part = process.argv[3] || 'TF';
var gitSha = function (t) { var b = Buffer.from(t, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + b.length + '\0'), b])).digest('hex'); };
(async function () {
  var b = await chromium.launch();
  async function setup(folder) {
    var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage();
    var S = { ctx: ctx, page: page, net: 'up', dialogs: [], errs: [], files: {}, blobs: {}, trees: {}, commits: 0, writes: 0 };
    page.on('pageerror', function (e) { S.errs.push(e.message); });
    page.on('dialog', function (d) { S.dialogs.push(d.type() + ': ' + d.message().replace(/\s+/g, ' ')); d.accept().catch(function () {}); });
    if (folder) await page.addInitScript(function () { window.showDirectoryPicker = function () { return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps', { create: true }); }); }; });
    var f = S.files;
    f['maps/glycolysis-graphml.md'] = '---\ntitle: "Glycolysis"\ntopic: "Glycolysis"\ngroup: "GraphML"\norder: 1\n---\n';
    f['maps/glycogen-muscle-graphml.md'] = '---\ntitle: "Glycogen metabolism (muscle)"\ntopic: "Glycogen metabolism (muscle)"\ngroup: "GraphML"\norder: 3\n---\n';
    f['maps/glycogen-liver-graphml.md'] = '---\ntitle: "Glycogen metabolism (liver)"\ntopic: "Glycogen metabolism (liver)"\ngroup: "GraphML"\norder: 4\n---\n';
    await page.route('https://api.github.com/**', async function (route) {
      if (S.net === 'down') return route.abort('internetdisconnected');
      var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '', meth = r.method();
      var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }); };
      if (S.net === 'refused') return json(401, { message: 'Bad credentials' });
      if (!m) return json(404, {});
      if (meth !== 'GET') S.writes++;
      if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
      if (rest === '') return json(200, { permissions: { push: true } });
      if (rest === '/contents/maps') return json(200, Object.keys(f).filter(function (p) { return /^maps\/[^/]+$/.test(p); }).map(function (p) { return { name: p.slice(5), path: p, type: 'file', sha: gitSha(f[p]) }; }));
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
        if (f[p2] == null) {   // a site map's file: the published one
          var mm = /^maps\/([^/]+)$/.exec(p2), pub = mm && !/\.md$/.test(p2) ? await ctx.request.get(new URL('/downloads/' + mm[1], base).href).catch(function () { return null; }) : null;
          if (pub && pub.ok()) f[p2] = await pub.text(); else return json(404, { message: 'Not Found' });
        }
        if (/raw/.test(r.headers().accept || '')) return route.fulfill({ status: 200, contentType: 'text/plain', body: f[p2] });
        return json(200, { sha: gitSha(f[p2]), content: Buffer.from(f[p2]).toString('base64') });
      }
      return json(404, { message: 'Not Found' });
    });
    await page.route('**/index.json*', async function (route) {
      if (S.offlineSite) return route.abort('internetdisconnected');
      var res = await route.fetch(), list = JSON.parse(await res.text());
      list.forEach(function (m) { m.deleted = ''; if (/^maps\/.+\//.test(m.editPath || '')) m.pageless = true; });
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) });
    });
    return S;
  }
  async function tools(S) {
    var page = S.page;
    var T = {};
    T.list = async function () { if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]'); await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 }); };
    T.menu = async function (sel, item) {
      await T.list();
      await page.click(sel, { button: 'right' }); await page.waitForTimeout(300);
      var btn = await page.$('.m2-cx button:text-is("' + item + '")');
      if (!btn) { var have = await page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); await page.keyboard.press('Escape'); return 'no item (' + have.join(' / ') + ')'; }
      await btn.click(); await page.waitForTimeout(400); return '';
    };
    T.status = function () { return page.$eval('#m2-ed-status', function (s) { return s.textContent; }).catch(function () { return ''; }); };
    T.listSay = function () { return page.evaluate(function () { return Array.from(document.querySelectorAll('#m2-list .m2-say, #m2-list .m2-note, #m2-list-say, .m2-list-note')).filter(function (e) { return e.offsetParent; }).map(function (e) { return e.textContent; }).join(' | '); }); };
    T.names = function () { return page.$$eval('#m2-list .m2-map', function (l) { return l.map(function (x) { return (x.classList.contains('m2-binned') ? '[D] ' : '') + x.textContent.trim(); }); }); };
    T.groupOf = function (id) { return page.$eval('#m2-list .m2-map[data-id="' + id + '"]', function (x) { var g = x.previousElementSibling; while (g && !g.classList.contains('m2-grp') && !g.classList.contains('m2-group') && !g.classList.contains('m2-bin')) g = g.previousElementSibling; return g ? g.textContent.trim() : '(top)'; }).catch(function () { return '(gone)'; }); };
    T.hash = function () { return page.evaluate(function () { return location.hash.slice(1); }); };
    T.load = async function (h) {
      await page.goto(base + '#' + (h || 'glycolysis-graphml'), { waitUntil: 'load' }); await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000);
    };
    T.rename = async function (sel, to) {
      var r = await T.menu(sel, 'Rename map'); if (r) return r;
      await page.waitForTimeout(300); await page.keyboard.press('Meta+A'); await page.keyboard.press('Control+A'); await page.keyboard.type(to); await page.keyboard.press('Enter'); return '';
    };
    T.edit = async function (make) {
      if (!(await page.$('#m2-editwin button[data-make]:visible'))) await page.click('.m2-ri[data-win="edit"]');
      await page.waitForSelector('#m2-editwin button[data-make]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
      var b0 = await page.$('#m2-editwin button[data-make="' + (make || 'macromolecule') + '"]') || await page.$('#m2-editwin button[data-make]');
      await b0.click(); await page.mouse.click(900, 450); await page.waitForTimeout(900); await page.keyboard.press('Escape');
    };
    T.idb = function () { return page.evaluate(function () { return new Promise(function (res) { var q = indexedDB.open('atlas-edit-drafts'); q.onsuccess = function () { try { var st = Array.from(q.result.objectStoreNames), out = {}, n = st.length; if (!n) return res(out); st.forEach(function (s) { var g = q.result.transaction(s).objectStore(s).getAll(); g.onsuccess = function () { out[s] = g.result.map(function (r) { return { id: r.id, title: r.title, site: r.site, hidden: r.hidden, deleted: r.deleted, len: (r.text || '').length, sha: r.sha }; }); if (!--n) res(out); }; g.onerror = function () { if (!--n) res(out); }; }); } catch (e) { res({ err: String(e) }); } }; q.onerror = function () { res({}); }; }); }); };
    T.ls = function () { return page.evaluate(function () { var o = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^atlas-(moved|named|bin|renamed|pending|unsent|mine-groups)/.test(k)) o[k] = localStorage.getItem(k).slice(0, 160); } return o; }); };
    T.folder = function () { return page.evaluate(function () { var out = []; function walk(d, p) { var it = d.entries(); return (function n() { return it.next().then(function (x) { if (x.done) return; var e = x.value; out.push(p + e[0] + (e[1].kind === 'directory' ? '/' : '')); return (e[1].kind === 'directory' ? walk(e[1], p + e[0] + '/') : Promise.resolve()).then(n); }); })(); } return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps'); }).then(function (m) { return walk(m, ''); }).then(function () { return out; }).catch(function (e) { return [String(e)]; }); }); };
    T.rec = async function (what, fn, wait) {
      S.dialogs.length = 0; var w0 = S.writes;
      var r = '';
      try { r = (await fn()) || ''; } catch (e) { r = 'ERROR ' + e.message.split('\n')[0]; }
      await page.waitForTimeout(wait || 4000);
      console.log('\n## ' + what + (r ? '  [' + r + ']' : ''));
      console.log('   pop-ups: ' + (S.dialogs.length ? S.dialogs.join(' || ') : 'none'));
      var st = await T.status(); if (st) console.log('   red/status line: ' + st);
      var ls = await T.listSay(); if (ls) console.log('   list line: ' + ls);
      console.log('   writes reaching GitHub: ' + (S.writes - w0));
    };
    return T;
  }

  if (/T/.test(part)) {
    console.log('# Part T: with a token, GitHub cut off after the page opened');
    var S = await setup(false), T = await tools(S), page = S.page;
    await page.goto(base, { waitUntil: 'load' });
    await page.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-token', 'test-token'); });
    await T.load('glycolysis-graphml');
    // made while up, used later while down
    await T.menu('#m2-list .m2-map[data-id="glycolysis-graphml"]', 'New SBGN-ML map'); await page.waitForTimeout(3000);
    var mine = await T.hash();
    await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800);
    await T.menu('#m2-list .m2-map[data-id="glycogen-liver-graphml"]', 'Delete map'); await page.waitForTimeout(3000);
    console.log('setup: own map ' + mine + ', liver deleted while up; commits ' + S.commits + '; files ' + Object.keys(S.files).filter(function (p) { return !/^maps\/glyco.*\.md$/.test(p); }).join(' '));
    var before = await T.names();
    S.net = process.env.NET || 'down';
    console.log('\n--- GitHub ' + S.net + ' from here ---');
    await T.rec('Rename map (site map Glycolysis -> Glycolysis X)', function () { return T.rename('#m2-list .m2-map[data-id="glycolysis-graphml"]', 'Glycolysis X'); });
    console.log('   list shows: ' + (await page.$eval('#m2-list .m2-map[data-id="glycolysis-graphml"]', function (x) { return x.textContent; }).catch(function () { return '?'; })));
    await T.rec('Rename map (own map, on GitHub)', function () { return T.rename('#m2-list .m2-map[data-id="' + mine + '"]', 'Mine renamed'); });
    console.log('   list shows: ' + (await page.$eval('#m2-list .m2-map[data-id="' + mine + '"]', function (x) { return x.textContent; }).catch(function () { return '?'; })));
    await T.rec('Rename group (site group GraphML -> GraphML X)', async function () {
      var r = await T.menu('#m2-list .m2-group:has-text("GraphML") >> nth=0', 'Rename group'); if (r) return r;
      await page.waitForTimeout(300); await page.keyboard.press('Control+A'); await page.keyboard.type('GraphML X'); await page.keyboard.press('Enter');
    });
    await T.rec('Move to... (site map Glycogen muscle to another group)', async function () {
      var r = await T.menu('#m2-list .m2-map[data-id="glycogen-muscle-graphml"]', 'Move to...'); if (r) return r;
      await page.waitForTimeout(300); var opts = await page.$$('.m2-cx button'); if (opts.length < 2) return 'no groups offered';
      var t = await opts[opts.length - 1].textContent(); await opts[opts.length - 1].click(); return 'to ' + t;
    });
    console.log('   now in: ' + (await T.groupOf('glycogen-muscle-graphml')));
    await T.rec('Make a copy (site map Glycolysis)', function () { return T.menu('#m2-list .m2-map[data-id="glycolysis-graphml"]', 'Make a copy'); }, 8000);
    console.log('   shown: ' + (await T.hash()));
    await page.click('.m2-ri[data-win="list"]').catch(function () {}); await page.waitForTimeout(800);
    await T.rec('New SBGN-ML map', function () { return T.menu('#m2-list .m2-map >> nth=0', 'New SBGN-ML map'); }, 8000);
    console.log('   shown: ' + (await T.hash()));
    await page.click('.m2-ri[data-win="list"]').catch(function () {}); await page.waitForTimeout(800);
    await T.rec('New CellDesigner map', function () { return T.menu('#m2-list .m2-map >> nth=0', 'New CellDesigner map'); }, 8000);
    console.log('   shown: ' + (await T.hash()));
    await page.click('.m2-ri[data-win="list"]').catch(function () {}); await page.waitForTimeout(800);
    await T.rec('Add map from file (a small SBGN-ML file)', async function () {
      var ch = page.waitForEvent('filechooser', { timeout: 5000 });
      var r = await T.menu('#m2-list .m2-map >> nth=0', 'Add map from file'); if (r) return r;
      var fc = await ch; await fc.setFiles({ name: 'offline-added.sbgn', mimeType: 'text/xml', buffer: Buffer.from('<?xml version="1.0" encoding="UTF-8"?><sbgn xmlns="http://sbgn.org/libsbgn/0.3"><map id="m" language="process description"><glyph class="macromolecule" id="g1"><label text="A"/><bbox x="10" y="10" w="60" h="30"/></glyph></map></sbgn>') });
    }, 8000);
    console.log('   shown: ' + (await T.hash()));
    await page.click('.m2-ri[data-win="list"]').catch(function () {}); await page.waitForTimeout(800);
    await T.rec('Delete map (site map Glycogen muscle)', function () { return T.menu('#m2-list .m2-map[data-id="glycogen-muscle-graphml"]', 'Delete map'); });
    console.log('   in Deleted: ' + (await page.$('#m2-list .m2-binned[data-id="glycogen-muscle-graphml"]') ? 'yes' : 'no') + '; in its group: ' + (await page.$('#m2-list .m2-map:not(.m2-binned)[data-id="glycogen-muscle-graphml"]') ? 'yes' : 'no'));
    await T.rec('Delete map (own map on GitHub)', function () { return T.menu('#m2-list .m2-map[data-id="' + mine + '"]', 'Delete map'); });
    console.log('   in Deleted: ' + (await page.$('#m2-list .m2-binned[data-id="' + mine + '"]') ? 'yes' : 'no'));
    var openBin = async function () { var h = await page.$eval('#m2-list .m2-bin', function (h) { return h.classList.contains('m2-shut'); }).catch(function () { return false; }); if (h) { await page.click('#m2-list .m2-bin'); await page.waitForTimeout(300); } };
    await openBin();
    await T.rec('Restore (site map liver, deleted while up)', function () { return T.menu('#m2-list .m2-binned[data-id="glycogen-liver-graphml"]', 'Restore'); });
    console.log('   in Deleted: ' + (await page.$('#m2-list .m2-binned[data-id="glycogen-liver-graphml"]') ? 'yes' : 'no'));
    await openBin();
    await T.rec('Delete forever (site map liver)', function () { return T.menu('#m2-list .m2-binned[data-id="glycogen-liver-graphml"], #m2-list .m2-map[data-id="glycogen-liver-graphml"]', 'Delete forever'); });
    console.log('   listed: ' + (await page.$('#m2-list .m2-map[data-id="glycogen-liver-graphml"]') ? 'yes' : 'no'));
    await T.rec('Add group', async function () { var r = await T.menu('#m2-list .m2-map >> nth=0', 'Add group'); if (r) return r; await page.waitForTimeout(300); await page.keyboard.type('Offline group'); await page.keyboard.press('Enter'); });
    await T.rec('Restore example maps', function () { return T.menu('#m2-list .m2-map >> nth=0', 'Restore example maps'); }, 8000);
    await T.rec('Download as MINERVA zip (a CellDesigner site map)', async function () {
      var cd = await page.$('#m2-list .m2-map[data-id$="-celldesigner"]'); if (!cd) return 'no CellDesigner map';
      var id = await cd.getAttribute('data-id'), dl = page.waitForEvent('download', { timeout: 20000 }).then(function (d) { return 'downloaded ' + d.suggestedFilename(); }, function () { return 'no download'; });
      var r = await T.menu('#m2-list .m2-map[data-id="' + id + '"]', 'Download as MINERVA zip'); if (r) return r;
      return id + ': ' + (await dl);
    }, 2000);
    await T.rec('Undo in the list (Cmd+Z, twice)', async function () { await T.list(); await page.click('#m2-list .m2-map >> nth=0'); await page.keyboard.press('Meta+z'); await page.waitForTimeout(1500); await page.keyboard.press('Meta+z'); });

    // editing a site map while GitHub is unreachable
    await T.rec('Edit a site map (Glycolysis GraphML): a node made', async function () { await page.click('#m2-list .m2-map[data-id="glycolysis-graphml"]').catch(function () {}); await page.waitForTimeout(1500); await T.edit(); }, 9000);
    await T.rec('Another move on it', async function () { await T.edit(); }, 9000);
    await T.rec('Edit window closed, another map opened', async function () { await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800); await page.click('#m2-list .m2-map[data-id="glycogen-muscle-graphml"], #m2-list .m2-map >> nth=2'); }, 3000);
    var leaving = [];
    page.once('dialog', function (d) { leaving.push(d.type()); });
    await T.rec('Page reloaded while GitHub is still unreachable (the moves not on GitHub)', async function () { await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); }, 5000);
    console.log('   leave-page warning: ' + (leaving.join(' ') || 'none (Playwright reload skips it; a person would get the browser\'s Leave page? question only for the map open in the editor)'));
    S.net = 'up';
    await T.rec('Connection back, page reloaded', async function () { await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); }, 8000);
    var g = S.files['maps/glycolysis-graphml.graphml'] || '';
    console.log('   Glycolysis on GitHub has the nodes made offline: ' + (g ? (/macromolecule|<y:NodeLabel[^>]*>\s*<\/y:NodeLabel>/.test(g) ? 'maybe (check)' : 'no') : 'file never written'));
    console.log('   GitHub files now: ' + Object.keys(S.files).join(' '));
    console.log('   browser: ' + JSON.stringify(await T.ls()));
    console.log('   names: ' + (await T.names()).slice(0, 12).join(' / '));
    console.log('   errors: ' + (S.errs.join(' | ') || 'none'));
    await S.ctx.close();
  }

  if (/F/.test(part)) {
    console.log('\n# Part F: no token, a folder chosen, the whole browser offline');
    var S2 = await setup(true), T2 = await tools(S2), p2 = S2.page;
    await p2.goto(base, { waitUntil: 'load' }); await p2.evaluate(function () { localStorage.clear(); });
    await T2.load('glycolysis-graphml');
    await T2.menu('#m2-list .m2-map[data-id="glycolysis-graphml"]', 'New SBGN-ML map'); await p2.waitForTimeout(3000);
    var own = await T2.hash();
    await T2.edit(); await p2.waitForTimeout(3000);
    var fb = await p2.$('#m2-ed-l-folder:visible'); if (fb) { await fb.click(); await p2.waitForTimeout(3000); }
    await T2.edit(); await p2.waitForTimeout(3000);
    console.log('setup: own map ' + own + ', folder chosen: ' + !!fb + '; folder: ' + (await T2.folder()).join(' '));
    await p2.click('.m2-ri[data-win="list"]'); await p2.waitForTimeout(800);
    await S2.ctx.setOffline(true); S2.net = 'down'; S2.offlineSite = true;
    console.log('\n--- browser offline from here ---');
    await T2.rec('Edit own map: a node made', async function () { await p2.click('#m2-list .m2-map[data-id="' + own + '"]'); await p2.waitForTimeout(1000); await T2.edit(); }, 5000);
    console.log('   folder: ' + (await T2.folder()).join(' '));
    await p2.click('.m2-ri[data-win="list"]'); await p2.waitForTimeout(800);
    await T2.rec('Rename own map', function () { return T2.rename('#m2-list .m2-map[data-id="' + own + '"]', 'Offline name'); });
    console.log('   folder: ' + (await T2.folder()).join(' '));
    await T2.rec('Make a copy (own map)', function () { return T2.menu('#m2-list .m2-map[data-id="' + own + '"]', 'Make a copy'); }, 5000);
    await p2.click('.m2-ri[data-win="list"]').catch(function () {}); await p2.waitForTimeout(800);
    await T2.rec('New SBGN-ML map', function () { return T2.menu('#m2-list .m2-map >> nth=0', 'New SBGN-ML map'); }, 5000);
    await p2.click('.m2-ri[data-win="list"]').catch(function () {}); await p2.waitForTimeout(800);
    await T2.rec('Delete map (own)', function () { return T2.menu('#m2-list .m2-map[data-id="' + own + '"]', 'Delete map'); });
    console.log('   folder: ' + (await T2.folder()).join(' '));
    await T2.rec('Make a copy (a site map never opened in this page: Glycogen muscle GraphML)', function () { return T2.menu('#m2-list .m2-map[data-id="glycogen-muscle-graphml"]', 'Make a copy'); }, 6000);
    await p2.click('.m2-ri[data-win="list"]').catch(function () {}); await p2.waitForTimeout(800);
    await T2.rec('Open a site map never opened in this page (click on it)', async function () { var cd = await p2.$('#m2-list .m2-map[data-id$="-celldesigner"]'); await cd.click(); }, 5000);
    console.log('   picture shown: ' + (await p2.evaluate(function () { var i = document.querySelector('#m2-map img, #m2-view img, .m2-pic img'); return i ? (i.complete && i.naturalWidth > 0 ? 'yes' : 'broken') : 'no img'; })));
    await T2.rec('Edit that site map (no token: draft in this browser)', async function () { await T2.edit(); }, 6000);
    await T2.rec('Download as MINERVA zip (that map)', async function () {
      var id = await T2.hash(), dl = p2.waitForEvent('download', { timeout: 20000 }).then(function (d) { return 'downloaded ' + d.suggestedFilename(); }, function () { return 'no download'; });
      await p2.click('.m2-ri[data-win="list"]').catch(function () {}); await p2.waitForTimeout(500);
      var r = await T2.menu('#m2-list .m2-map[data-id="' + id + '"]', 'Download as MINERVA zip'); if (r) return r; return await dl;
    }, 2000);
    await T2.rec('Page reloaded while offline', async function () { await p2.reload({ waitUntil: 'load', timeout: 15000 }); }, 3000);
    console.log('   page: ' + (await p2.evaluate(function () { return document.title + ' | ' + document.body.innerText.slice(0, 120).replace(/\s+/g, ' '); }).catch(function (e) { return 'error ' + e.message.split('\n')[0]; })));
    await S2.ctx.setOffline(false); S2.net = 'up'; S2.offlineSite = false;
    await T2.rec('Back online, page reloaded', async function () { await p2.reload({ waitUntil: 'load' }); await p2.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); }, 5000);
    console.log('   names: ' + (await T2.names()).slice(0, 10).join(' / '));
    console.log('   folder: ' + (await T2.folder()).join(' '));
    console.log('   errors: ' + (S2.errs.join(' | ') || 'none'));
    await S2.ctx.close();
  }

  if (/E/.test(part)) {
    console.log('\n# Part E: with a token, a site map edited while GitHub is unreachable, then the tab reloaded');
    var S3 = await setup(false), T3 = await tools(S3), p3 = S3.page, ID = 'tag-celldesigner';
    await p3.goto(base, { waitUntil: 'load' });
    await p3.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-token', 'test-token'); });
    await T3.load(ID);
    await T3.rec('While up: a protein made', function () { return T3.edit('cd:PROTEIN'); }, 9000);
    var f0 = S3.files['maps/' + ID + '.xml'] || '', n0 = (f0.match(/<celldesigner:speciesAlias /g) || []).length;
    console.log('   on GitHub: ' + n0 + ' species aliases');
    S3.net = 'down';
    await T3.rec('Down: a second protein made', function () { return T3.edit('cd:PROTEIN'); }, 9000);
    await T3.rec('Down: a third', function () { return T3.edit('cd:PROTEIN'); }, 9000);
    await T3.rec('Down: list opened, another map shown', async function () { await p3.click('.m2-ri[data-win="list"]'); await p3.waitForTimeout(800); await p3.click('#m2-list .m2-map[data-id="glycolysis-graphml"]'); }, 4000);
    var gone = [];
    p3.on('dialog', function (d) { gone.push(d.type()); });
    var reloadWarn = await p3.evaluate(function () { var e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
    console.log('   the browser would ask before leaving now: ' + (reloadWarn ? 'yes' : 'no'));
    await T3.rec('Down: tab reloaded', async function () { await p3.reload({ waitUntil: 'load' }); await p3.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); }, 5000);
    console.log('   kept in this browser: ' + JSON.stringify(await T3.idb()).slice(0, 400));
    S3.net = 'up';
    await T3.rec('Up again, tab reloaded', async function () { await p3.reload({ waitUntil: 'load' }); await p3.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); }, 9000);
    var f1 = S3.files['maps/' + ID + '.xml'] || '';
    console.log('   on GitHub: ' + (f1.match(/<celldesigner:speciesAlias /g) || []).length + ' species aliases (before going down ' + n0 + ')');
    await T3.rec('Up: the map opened for editing again', async function () { await p3.click('.m2-ri[data-win="list"]').catch(function () {}); await p3.waitForTimeout(500); await p3.click('#m2-list .m2-map[data-id="' + ID + '"]'); await p3.waitForTimeout(1500); if (!(await p3.$('#m2-editwin button[data-make]:visible'))) await p3.click('.m2-ri[data-win="edit"]'); await p3.waitForSelector('#m2-editwin button[data-make]', { state: 'visible', timeout: 30000 }); }, 4000);
    console.log('   errors: ' + (S3.errs.join(' | ') || 'none'));
    // the same, but the editing not left: tab reloaded while the map is open in the editor
    S3.net = 'down';
    await T3.rec('Down again: a protein made, the map still open', function () { return T3.edit('cd:PROTEIN'); }, 9000);
    reloadWarn = await p3.evaluate(function () { var e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
    console.log('   the browser would ask before leaving now: ' + (reloadWarn ? 'yes' : 'no'));
    await p3.reload({ waitUntil: 'load' }); await p3.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await p3.waitForTimeout(3000);
    S3.net = 'up';
    await p3.reload({ waitUntil: 'load' }); await p3.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await p3.waitForTimeout(9000);
    var f2 = S3.files['maps/' + ID + '.xml'] || '';
    console.log('   after Leave page and back up: on GitHub ' + (f2.match(/<celldesigner:speciesAlias /g) || []).length + ' species aliases');
    console.log('   status: ' + (await T3.status()));
    await S3.ctx.close();
  }
  await b.close();
})();
