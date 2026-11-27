// The page opening offline (sw.js, the site's service worker; atlas-app.html, kept for offline): the first visit keeps
// the page, its code and the maps seen; offline the same address opens with the list and the map; a map whose picture
// is not kept is grey and says so; the editor opens offline on a kept map; a new page is taken at the next load with a
// connection; the kill switch drops every copy and the worker.
//   node tests/offline-page.js [base address]
// Parts: A first visit kept; B a reload offline; C a map not kept; D the editor offline; E online again; F a new page
// taken at the next load; G the kill switch (a sw.js with KILL = true served by this script).
var { chromium } = require('playwright');
var base = process.argv.slice(2).filter(function (a) { return a[0] !== '-'; })[0] || 'https://viewer-source.github.io/styles/';
var scope = new URL(base).pathname;
var bad = 0;
function ok(what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); }
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
(async function () {
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(function () { try { localStorage.setItem('atlas-sw-test', '1'); } catch (e) {} });
  var page = await ctx.newPage(), errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  var names = function () { return page.evaluate(function () { return caches.keys(); }); };
  var keys = function () {
    return page.evaluate(function (scope) {
      return caches.open('offline-1:' + scope).then(function (c) { return c.keys(); }).then(function (ks) { return ks.map(function (k) { return new URL(k.url).pathname; }); });
    }, scope);
  };
  var rows = function () { return page.$$eval('#m2-list .m2-map', function (bs) { return bs.map(function (x) { return { id: x.dataset.id, off: x.classList.contains('m2-off'), tip: x.title }; }); }); };
  var shown = function () { return page.evaluate(function () { var i = document.getElementById('m2-img'); return !!i && i.style.visibility !== 'hidden' && (i.naturalWidth > 0 || i.tagName.toLowerCase() === 'svg'); }); };

  // A: the first visit
  await page.goto(base + '#glycolysis-graphml');
  await page.waitForFunction(function () { return navigator.serviceWorker && navigator.serviceWorker.controller; }, null, { timeout: 30000 }).catch(function () {});
  ok('A a worker controls the page', await page.evaluate(function () { return !!navigator.serviceWorker.controller; }));
  await page.waitForFunction(function () { var i = document.getElementById('m2-img'); return i && i.style.visibility !== 'hidden'; }, null, { timeout: 30000 }).catch(function () {});
  await wait(12000);   // the list's pictures and the steps ahead
  var k = await keys();
  ok('A the page kept', k.indexOf(scope) >= 0, k.length + ' files kept');
  ok('A the list kept', k.indexOf('/index.json') >= 0);
  ok('A the map shown kept (picture)', k.some(function (p) { return /glycolysis-graphml.*\.svg$/.test(p); }));
  ok('A the map shown kept (its own file)', k.some(function (p) { return /^\/downloads\/glycolysis-graphml\.graphml$/.test(p); }));
  var size = await page.evaluate(function () { return fetch('/index.json').then(function (r) { return r.json(); }).then(function (l) { return l.filter(function (m) { return m.size > 0; }).length + ' of ' + l.length; }); });
  ok('A sizes in the index', !/^0 of/.test(size), size);

  // D first part: the Edit tab opened online, the drawing code fetched ahead
  await page.keyboard.press('e').catch(function () {});
  await page.waitForFunction(function () { return !!window.m2Editor; }, null, { timeout: 30000 }).catch(function () {});
  await wait(8000);
  k = await keys();
  ['/editor/editor.js', '/renderers/converter/cdrender.js', '/renderers/converter/sbgn_edit.js', '/renderers/yrender/yrender.js'].forEach(function (f) {
    ok('D code kept ahead: ' + f, k.indexOf(scope.replace(/\/$/, '') + f) >= 0);
  });
  await page.keyboard.press('e').catch(function () {});
  await wait(1000);

  // B: a reload offline
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(function (e) { ok('B reload offline', false, e.message); });
  await page.waitForFunction(function () { return document.querySelectorAll('#m2-list .m2-map').length > 3; }, null, { timeout: 20000 }).catch(function () {});
  var r = await rows();
  ok('B the list shown offline', r.length > 3, r.length + ' maps');
  await page.waitForFunction(function () { var i = document.getElementById('m2-img'); return i && i.style.visibility !== 'hidden'; }, null, { timeout: 20000 }).catch(function () {});
  ok('B the map shown offline', await shown());

  // C: a map not kept (its picture taken out of the copies)
  var gone = r.filter(function (x) { return x.id !== 'glycolysis-graphml'; })[0].id;
  await page.evaluate(function (a) {
    return caches.open('offline-1:' + a.scope).then(function (c) {
      return c.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return new URL(k.url).pathname.indexOf('/' + a.id) >= 0 && /\.(svg|png)$/.test(new URL(k.url).pathname); }).map(function (k) { return c.delete(k); })); });
    });
  }, { scope: scope, id: gone });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(function () { return document.querySelector('#m2-list .m2-map.m2-off'); }, null, { timeout: 15000 }).catch(function () {});
  r = await rows();
  var g = r.filter(function (x) { return x.id === gone; })[0];
  ok('C the map not kept is grey', g && g.off, gone);
  ok('C its tip says Not available offline', g && /Not available offline/.test(g.tip));
  ok('C the kept map is not grey', r.filter(function (x) { return x.id === 'glycolysis-graphml'; }).every(function (x) { return !x.off; }));
  await page.click('#m2-list .m2-map[data-id="' + gone + '"]');
  await page.waitForSelector('#m2-offnote', { timeout: 8000 }).catch(function () {});
  ok('C chosen, the view says Not available offline', await page.evaluate(function () { var n = document.getElementById('m2-offnote'); return !!n && /Not available offline/.test(n.textContent); }));
  await page.click('#m2-list .m2-map[data-id="glycolysis-graphml"]');
  await wait(1500);
  ok('C the note goes with a kept map', !(await page.$('#m2-offnote')));

  // D: the editor offline on the kept map
  await page.keyboard.press('e');
  await page.waitForFunction(function () { return document.querySelector('.m2-editing'); }, null, { timeout: 20000 }).catch(function () {});
  ok('D editing starts offline', !!(await page.$('.m2-editing')));
  var red = await page.evaluate(function () { var s = document.getElementById('m2-ed-status'); return s ? s.textContent : ''; });
  ok('D no red line', !/did not load|not found/.test(red), red);
  await page.keyboard.press('e').catch(function () {});

  // E: online again, nothing grey
  await ctx.setOffline(false);
  await page.waitForFunction(function () { return !document.querySelector('#m2-list .m2-map.m2-off'); }, null, { timeout: 10000 }).catch(function () {});
  ok('E online, nothing grey', (await rows()).every(function (x) { return !x.off; }));

  // F: a new page taken at the next load with a connection (the page marked by this script), kept for offline
  var mark = 'm2-test-' + Date.now();
  await ctx.route(function (u) { return u.pathname === scope; }, async function (route) {
    var res = await route.fetch(); var t = await res.text();
    route.fulfill({ response: res, body: t.replace('</body>', '<i id="' + mark + '"></i></body>') });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  ok('F the new page taken online', !!(await page.$('#' + mark)));
  await ctx.unroute(function (u) { return u.pathname === scope; });
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  ok('F offline, the newest page kept', !!(await page.$('#' + mark)));
  await ctx.setOffline(false);

  // G: the kill switch
  await ctx.route(function (u) { return u.pathname === scope + 'sw.js'; }, async function (route) {
    var res = await route.fetch(); var t = await res.text();
    route.fulfill({ response: res, body: t.replace('var KILL = false;', 'var KILL = true;') });
  });
  await page.evaluate(function () { return navigator.serviceWorker.getRegistration().then(function (g) { return g && g.update(); }); }).catch(function () {});
  await wait(5000);
  var left = await page.evaluate(function () { return navigator.serviceWorker.getRegistrations().then(function (l) { return l.length; }); }).catch(function () { return -1; });
  ok('G the worker gone', left === 0, left + ' left');
  var n = await names().catch(function () { return []; });
  ok('G the copies gone', !n.some(function (x) { return x === 'offline-1:' + scope; }), n.join(', '));
  ok('G the page works from the network', (await rows()).length > 3);
  ok('no page error', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
