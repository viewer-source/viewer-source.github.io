// Today's save paths, pinned before the restructuring changes them: GitHub, a folder on the computer, this browser's
// store. On the styles page, Glycolysis (GraphML) moved by the arrow keys.
// 1. GitHub (played by this script, files from a clone of the site's data repository): a save refused as changed while
//    the file there is still the one last saved (another tab moved the branch) goes again on the new sha; a save refused
//    as changed by someone else leaves their file, says so and saves nothing more; the browser's storage full for the
//    kept drawing does not stop a save.
// 2. A folder (the browser's private file system, handed out by showDirectoryPicker), no token: each move written into
//    the map's file there; a file changed by another program never overwritten (written beside it, -2); the folder gone
//    said, Choose a folder offered again.
// 3. This browser's store, no token and no folder: each move kept as a draft and shown again after a reload; the store
//    full said; the site's data cleared, the site's map comes back.
// What happens to the moves after a refusal as changed is printed, not checked (plan 3 step 1 changes it).
//   node tests/save-paths.js <base address> <clone of the site's data repository>
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
var data = process.argv[3];
if (!data) { console.log('usage: node tests/save-paths.js <base address> <clone of the data repository>'); process.exit(2); }
var MAP = 'glycolysis-graphml', bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

function helpers(page) {
  var h = {};
  h.status = function () { return page.$eval('#m2-ed-status', function (s) { return s.textContent; }).catch(function () { return ''; }); };
  h.now = function () { return page.evaluate(function () { var n = window.m2EditNow(); return n ? n.text : null; }); };
  h.edit = async function () {
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    await page.click('.m2-ri[data-win="edit"]');
    await page.waitForFunction(function () { return !!window.m2EditNow(); }, null, { timeout: 30000 }); await page.waitForTimeout(1500);
  };
  h.leave = async function () { await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800); };
  h.move = async function () {
    var before = await h.now();
    var c = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.left > 300 && r.top > 100 && r.right < 1380 && r.bottom < 880) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; });
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);   // a second click on a selected node deselects it
    await page.mouse.click(c[0], c[1]); await page.waitForTimeout(300);
    for (var i = 0; i < 2; i++) { await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(120); }
    await page.waitForTimeout(400);
    if ((await h.now()) === before) console.log('note  a move changed nothing');
  };
  h.open = async function () { await page.goto(base + '#' + MAP, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(1500); };
  return h;
}

async function github(b) {
  console.log('-- GitHub');
  var page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], h = helpers(page);
  page.on('pageerror', function (e) { errs.push(e.message); });
  var sha = {}, puts = [], body = {};
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '';
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (rest === '') return json(200, { permissions: { push: true } });
    var c = rest.match(/^\/contents\/(.+)$/);
    if (c && r.method() === 'PUT') {
      var p = decodeURIComponent(c[1]), d = JSON.parse(r.postData());
      puts.push({ path: p, sha: d.sha });
      if (sha[p] && d.sha !== sha[p]) return json(409, { message: 'test: sha does not match' });   // as GitHub: a save on an older version refused
      body[p] = Buffer.from(d.content, 'base64').toString('utf8'); sha[p] = 'saved' + puts.length;
      return json(200, { content: { sha: sha[p] } });
    }
    if (c) {
      var p2 = decodeURIComponent(c[1]), f = path.join(data, p2);
      var text = body[p2] != null ? body[p2] : fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f, 'utf8') : null;
      if (text == null) return json(404, { message: 'Not Found' });
      if (!sha[p2]) sha[p2] = 'start';
      if (/raw/.test(r.headers().accept || '')) return route.fulfill({ status: 200, contentType: 'text/plain', body: text });
      return json(200, { sha: sha[p2], content: Buffer.from(text).toString('base64') });
    }
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    return json(404, { message: 'Not Found' });
  });
  await page.addInitScript(function () {   // the kept drawing's storage full on demand (window.__full)
    var set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (window.__full && k === 'atlas-edit-kept') throw new DOMException('test: full', 'QuotaExceededError'); return set.call(this, k, v); };
  });
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-token', 'test-token'); });
  await h.open(); await h.edit();
  await h.move(); await page.waitForTimeout(5000);
  var p = puts.length ? puts[0].path : null;
  ok('a move saved', puts.length === 1 && body[p] === (await h.now()), puts.length + ' ' + p);

  // another tab saved the same file: the branch moved, the file as last saved
  sha[p] = 'branch-moved';
  await h.move(); var t2 = await h.now(); await page.waitForTimeout(6000);
  var after = puts.slice(1);
  ok('refused as changed, the file still ours: saved again on the new sha', after.length === 2 && after[0].sha !== 'branch-moved' && after[1].sha === 'branch-moved' && body[p] === t2,
    after.map(function (x) { return x.sha; }).join(','));
  ok('and nothing said', !/Not saved/.test(await h.status()), await h.status());

  // the kept drawing finds the browser's storage full: the save goes through all the same
  await page.evaluate(function () { window.__full = true; });
  var n0 = puts.length; await h.move(); var t3 = await h.now(); await page.waitForTimeout(5000);
  ok('storage full for the kept drawing: the save goes through', puts.length === n0 + 1 && body[p] === t3);
  ok('and nothing said', !/Not saved/.test(await h.status()), await h.status());
  await page.evaluate(function () { window.__full = false; });

  // someone else changed the file
  var other = body[p].replace(/<\/graphml>\s*$/, '<!-- another person -->\n</graphml>\n');
  sha[p] = 'someone-else'; body[p] = other;
  n0 = puts.length; await h.move(); var t4 = await h.now(); await page.waitForTimeout(6000);
  ok('refused as changed by someone else: their file kept', body[p] === other && t4 !== other);
  ok('and said', /changed on GitHub since it was opened/.test(await h.status()), await h.status());
  var n1 = puts.length; await h.move(); await page.waitForTimeout(5000);
  ok('after it, nothing more is saved', puts.length === n1, (puts.length - n1) + ' saves');
  var lastMoves = await h.now();
  await h.leave(); await h.edit(); await page.waitForTimeout(3000);
  var back = await h.now();
  console.log('info  today, opened again after that refusal: ' + (back === other ? "the other person's file, the moves since the last save gone" : back === lastMoves ? 'the moves kept' : 'another text'));
  ok('no script error', !errs.length, errs.join(' | '));
  await page.close();
}

async function folder(b) {
  console.log('-- Folder');
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [], h = helpers(page);
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.addInitScript(function () {
    window.showDirectoryPicker = function () { return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps', { create: true }); }); };
  });
  var files = function () {
    return page.evaluate(function () {
      return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps'); }).then(function (d) {
        var it = d.values(), out = {};
        return (function n() { return it.next().then(function (x) { if (x.done) return out; if (x.value.kind !== 'file') return n(); return x.value.getFile().then(function (f) { return f.text(); }).then(function (t) { out[x.value.name] = t; return n(); }); }); })();
      }).catch(function (e) { return { error: String(e) }; });
    });
  };
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); });
  await h.open(); await h.edit();
  await h.move(); await page.waitForTimeout(2000);
  await page.click('#m2-ed-l-folder'); await page.waitForTimeout(3000);
  var f = await files(), names = Object.keys(f), t1 = await h.now();
  ok('folder chosen: the map written there', names.length === 1 && f[names[0]] === t1, names.join(','));
  var nm = names[0];
  await h.move(); await page.waitForTimeout(3000);
  var t2 = await h.now(); f = await files();
  ok('the next move written into the same file', Object.keys(f).length === 1 && f[nm] === t2);
  var mark = t2.replace(/<\/graphml>\s*$/, '<!-- changed in yEd -->\n</graphml>\n');
  await page.evaluate(function (a) {
    return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps'); }).then(function (d) { return d.getFileHandle(a[0]); })
      .then(function (fh) { return fh.createWritable(); }).then(function (w) { return w.write(a[1]).then(function () { return w.close(); }); });
  }, [nm, mark]);
  await page.waitForTimeout(1100);   // a later modification time
  await h.move(); await page.waitForTimeout(3000);
  var t3 = await h.now(), beside = nm.replace(/(\.[^.]+)$/, '-2$1'); f = await files();
  ok('a file changed by another program is not overwritten', f[nm] === mark);
  ok('the move written beside it', f[beside] === t3, Object.keys(f).join(','));
  await page.evaluate(function () { return navigator.storage.getDirectory().then(function (r) { return r.removeEntry('maps', { recursive: true }); }); });
  await h.move(); await page.waitForTimeout(3000);
  ok('the folder gone: said', /Not saved to the folder/.test(await h.status()), await h.status());
  ok('and Choose a folder offered again', await page.$eval('#m2-ed-l-folder', function (e) { return !e.hidden && !!e.offsetParent; }).catch(function () { return false; }));
  ok('no script error', !errs.length, errs.join(' | '));
  await ctx.close();
}

async function browser(b) {
  console.log('-- This browser');
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [], h = helpers(page);
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.addInitScript(function () {   // the store full on demand (window.__full): IndexedDB refuses a draft
    var put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () { if (window.__full && this.name === 'maps') throw new DOMException('test: full', 'QuotaExceededError'); return put.apply(this, arguments); };
  });
  var draft = function () {
    return page.evaluate(function (id) {
      return new Promise(function (res) {
        var r = indexedDB.open('atlas-edit-drafts');
        r.onsuccess = function () { var d = r.result; if (!d.objectStoreNames.contains('maps')) { d.close(); return res(null); } var q = d.transaction('maps').objectStore('maps').get(id); q.onsuccess = function () { d.close(); res(q.result ? q.result.text : null); }; q.onerror = function () { d.close(); res(null); }; };
        r.onerror = function () { res(null); };
      });
    }, MAP);
  };
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); });
  await h.open(); await h.edit();
  var t0 = await h.now();
  await h.move(); await page.waitForTimeout(2500);
  var t1 = await h.now();
  ok('a move kept as a draft in this browser', (await draft()) === t1 && t1 !== t0);
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(2500);
  ok('after a reload the draft is shown', await page.$eval('#m2-draft', function (e) { return !e.hidden; }).catch(function () { return false; }));
  if (!(await page.$('#m2-editwin:visible'))) await h.edit(); else await page.waitForFunction(function () { return !!window.m2EditNow(); }, null, { timeout: 30000 });
  ok('and editing goes on from it', (await h.now()) === t1);
  await page.evaluate(function () { window.__full = true; });
  await h.move(); await page.waitForTimeout(2500);
  ok('the store full: said', /Not kept in this browser/.test(await h.status()), await h.status());
  ok('the draft before it left as it was', (await draft()) === t1);
  await page.evaluate(function () { window.__full = false; });
  await h.leave();
  var cdp = await ctx.newCDPSession(page);
  await cdp.send('Storage.clearDataForOrigin', { origin: new URL(base).origin, storageTypes: 'all' });
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(2500);
  ok("the site's data cleared: no draft shown", await page.$eval('#m2-draft', function (e) { return e.hidden; }).catch(function () { return true; }));
  await h.edit();
  ok("and editing starts from the site's map", (await h.now()) === t0);
  ok('no script error', !errs.length, errs.join(' | '));
  await ctx.close();
}

(async function () {
  var b = await chromium.launch();
  await github(b); await folder(b); await browser(b);
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
