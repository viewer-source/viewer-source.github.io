// Gestures on the live page (book Gestures): a mouse or trackpad drag selects an area and never moves the map, in view
// and edit mode; the area's right-click menu copies its names; a click clears it; Shift with the wheel moves the map
// sideways only; Space held with the wheel scrolls the page and leaves the map still.
//   node tests/gestures.js [page address]
var { chromium } = require('playwright');
var URL0 = process.argv[2] || 'https://viewer-source.github.io/styles/#glycolysis-sbgn';
(async function () {
  var b = await chromium.launch(), bad = 0, errs = [];
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  var page = await ctx.newPage();
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.goto(URL0, { waitUntil: 'load' });
  await page.waitForFunction(function () { var i = document.getElementById('m2-img'); return i && i.style.width; }, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  ok('the page has the area element', !!(await page.$('#m2-area')));
  var tf = function () { return page.$eval('#m2-img', function (i) { return i.style.transform; }); };
  var v = await page.$eval('#m2-view', function (e) { var r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  var cx = v[0] + v[2] / 2, cy = v[1] + v[3] / 2;
  var t0 = await tf();
  await page.mouse.move(cx - 150, cy - 120); await page.mouse.down(); await page.mouse.move(cx + 150, cy + 120, { steps: 10 }); await page.mouse.up();
  ok('view mode: a drag leaves the map still', (await tf()) === t0, t0 + ' -> ' + (await tf()));
  ok('view mode: the area shows', await page.$eval('#m2-area', function (e) { return e.style.display === 'block' && e.offsetWidth > 250; }));
  await page.mouse.click(cx, cy, { button: 'right' }); await page.waitForTimeout(300);
  var menu = await page.$$eval('.m2-cx button, .m2-cx .m2-cx-head', function (l) { return l.map(function (x) { return x.textContent.trim(); }); });
  ok('right click inside: the area menu', menu[0] === 'Selected area' && menu.indexOf('Copy image as PNG') >= 0, menu.join(' | '));
  if (menu.indexOf('Copy names') >= 0) {
    await page.click('.m2-cx button:has-text("Copy names")'); await page.waitForTimeout(400);
    var txt = await page.evaluate(function () { return navigator.clipboard.readText(); });
    ok('Copy names: one name per line', txt.split('\n').length >= 1 && txt.length > 0, JSON.stringify(txt.slice(0, 80)));
    console.log('      names: ' + txt.split('\n').slice(0, 6).join(', '));
  } else ok('Copy names offered (a map with names inside the area)', false, menu.join(' | '));
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  await page.mouse.click(v[0] + 30, v[1] + v[3] - 40); await page.waitForTimeout(200);
  ok('a click clears the area', await page.$eval('#m2-area', function (e) { return e.style.display === 'none'; }));
  var parse = function (s) { var m = s.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/); return m ? [+m[1], +m[2]] : [0, 0]; };
  var a = parse(await tf());
  await page.mouse.move(cx, cy); await page.keyboard.down('Shift'); await page.mouse.wheel(0, 120); await page.keyboard.up('Shift'); await page.waitForTimeout(200);
  var c = parse(await tf());
  ok('Shift with the wheel: sideways only', Math.abs(c[0] - a[0]) > 20 && Math.abs(c[1] - a[1]) < 0.5, a + ' -> ' + c);
  var y0 = await page.evaluate(function () { return window.scrollY; });
  await page.keyboard.down('Space'); await page.mouse.wheel(0, 200); await page.keyboard.up('Space'); await page.waitForTimeout(300);
  var y1 = await page.evaluate(function () { return window.scrollY; }), d = parse(await tf());
  ok('Space with the wheel: the page scrolls, the map stays', y1 > y0 && d[0] === c[0] && d[1] === c[1], y0 + ' -> ' + y1 + ', ' + c + ' -> ' + d);
  await page.evaluate(function () { window.scrollTo(0, 0); }); await page.waitForTimeout(200);
  await page.mouse.move(cx, cy); await page.keyboard.press('Space'); await page.waitForTimeout(200);
  ok('Space alone over the map: the page does not step down', (await page.evaluate(function () { return window.scrollY; })) === 0);
  // edit mode
  if (await page.$('.m2-ri[data-win="edit"]')) {
    await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(2500);
    var e0 = await tf(), sawBand = false;
    await page.mouse.move(v[0] + 40, v[1] + 40); await page.mouse.down(); await page.mouse.move(cx, cy, { steps: 6 });
    sawBand = !!(await page.$('#m2-edit-layer .m2-ed-band'));
    await page.mouse.move(cx + 200, cy + 150, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
    ok('edit mode: a drag draws the area band', sawBand);
    ok('edit mode: a drag leaves the map still', (await tf()) === e0, e0 + ' -> ' + (await tf()));
    ok('edit mode: the viewer area stays hidden', await page.$eval('#m2-area', function (e) { return e.style.display !== 'block'; }));
    var sel = await page.$$eval('#m2-edit-layer .m2-ed-handle, #m2-edit-layer [class*="m2-ed-sel"]', function (l) { return l.length; });
    ok('edit mode: something selected by the area', sel > 0, 'marks ' + sel);
  } else console.log('      (no Edit tab on this page)');
  ok('no script errors', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
