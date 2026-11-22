// Without a token: the Edit window's reminder, and Colours' Original kept in the chosen folder (core.js origToFolder,
// .viewer/colours/<file>.json), so it is found when this browser's own record is gone. The folder is played by the
// browser's private file system (navigator.storage), handed out by showDirectoryPicker. On the styles page, the
// triacylglycerol map (CellDesigner). Nothing is saved to the site.
//   node tests/original-folder.js [base address] [viewer folder: its editor served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3], bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
(async function () {
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [];
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route(/\/renderers\/converter\/(sbgn_edit|cd_make)\.js/, function (r) { var f = /(sbgn_edit|cd_make)\.js/.exec(r.request().url())[0]; r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', f), 'utf8') }); });
  }
  await page.addInitScript(function () {
    if (!document.getElementById('m2-ed-l5')) document.addEventListener('DOMContentLoaded', function () {   // the page's line, where the page served is older than the editor
      var l1 = document.getElementById('m2-ed-l1');
      if (l1 && !document.getElementById('m2-ed-l5')) { var p = document.createElement('p'); p.id = 'm2-ed-l5'; p.className = 'm2-set-note'; p.hidden = true; l1.after(p); }
    });
    window.showDirectoryPicker = function () { return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps', { create: true }); }); };
  });
  page.on('pageerror', function (e) { errs.push(e.message); });
  var F = '#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd';
  var val = function () { return page.$eval(F, function (e) { return e.firstChild.textContent; }); };
  var paint = function () { return page.evaluate(function () { var d = new DOMParser().parseFromString(window.m2EditNow().svg, 'image/svg+xml'); return Array.from(d.querySelectorAll('[fill]')).map(function (e) { return e.getAttribute('fill'); }).join(' ').toLowerCase(); }); };
  var pick = async function (name) { await page.click(F); await page.waitForTimeout(200); await page.click('body > .m2-ed-pdl button:has-text("' + name + '")'); await page.waitForTimeout(3000); };
  var shown = function (sel) { return page.$eval(sel, function (e) { return !e.hidden && !!e.offsetParent; }).catch(function () { return false; }); };
  var open = async function () {
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    if (!(await page.$(F + ':visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector(F, { state: 'visible', timeout: 30000 });
    await page.waitForFunction(function () { var n = window.m2EditNow && window.m2EditNow(); return n && n.svg; }, null, { timeout: 30000 }); await page.waitForTimeout(2000);
  };
  await page.goto(base + '#tag-celldesigner', { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); });
  await page.reload({ waitUntil: 'load' }); await open();
  var p0 = await paint();
  await pick('Mist and sage');
  ok('First change: the full text about this browser', await shown('#m2-ed-l1'));
  ok('First change: no short reminder yet', !(await shown('#m2-ed-l5')));
  await page.reload({ waitUntil: 'load' }); await open();
  ok('Next visit: the short reminder stays', await shown('#m2-ed-l5'), await page.$eval('#m2-ed-l5', function (e) { return e.textContent; }));
  ok('Next visit: the full text not again', !(await shown('#m2-ed-l1')));
  await page.click('#m2-ed-l-folder'); await page.waitForTimeout(3000);
  ok('Folder chosen: the reminder gone', !(await shown('#m2-ed-l5')));
  await pick('Original'); await pick('Confetti'); await page.waitForTimeout(2000);
  var inFolder = await page.evaluate(function () {
    return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps'); }).then(function (m) { return m.getDirectoryHandle('.viewer'); })
      .then(function (v) { return v.getDirectoryHandle('colours'); }).then(function (c) { var it = c.keys(), out = []; return (function n() { return it.next().then(function (x) { if (x.done) return out; out.push(x.value); return n(); }); })(); }).catch(function (e) { return String(e); });
  });
  ok('The map’s own colours in the folder’s .viewer/colours/', Array.isArray(inFolder) && inFolder.length === 1, JSON.stringify(inFolder));
  await page.evaluate(function () { localStorage.removeItem('atlas-edit-originals'); });   // this browser's record gone
  await pick('Original');
  ok('Original from the folder alone, the drawing as it was', (await paint()) === p0);
  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok'); process.exit(bad ? 1 : 0);
})();
