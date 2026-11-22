// Gestures on the live page (book Gestures): a mouse or trackpad drag moves the map and Shift with a drag selects an
// area, in view and edit mode; the area's right-click menu zooms to it or copies it as PNG; a click clears it; Shift with the wheel moves the map
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
  var g0 = await tf();
  await page.mouse.move(cx - 150, cy - 120); await page.mouse.down(); await page.mouse.move(cx + 150, cy + 120, { steps: 10 }); await page.mouse.up();
  ok('view mode: a drag moves the map', (await tf()) !== g0, g0 + ' -> ' + (await tf()));
  ok('view mode: a drag draws no area', await page.$eval('#m2-area', function (e) { return e.style.display !== 'block'; }));
  var t0 = await tf();
  var shiftDrag = async function (x1, y1, x2, y2) { await page.keyboard.down('Shift'); await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y2, { steps: 10 }); await page.mouse.up(); await page.keyboard.up('Shift'); };
  await shiftDrag(cx - 150, cy - 120, cx + 150, cy + 120);
  ok('view mode: Shift with a drag leaves the map still', (await tf()) === t0, t0 + ' -> ' + (await tf()));
  ok('view mode: the area shows', await page.$eval('#m2-area', function (e) { return e.style.display === 'block' && e.offsetWidth > 250; }));
  ok('view mode: the area is an outline only, no fill', await page.$eval('#m2-area', function (e) { var b = getComputedStyle(e).backgroundColor; return b === 'rgba(0, 0, 0, 0)' || b === 'transparent'; }));
  await page.mouse.click(cx, cy, { button: 'right' }); await page.waitForTimeout(300);
  var menu = await page.$$eval('.m2-cx button, .m2-cx .m2-cx-head', function (l) { return l.map(function (x) { return x.textContent.trim(); }); });
  ok('right click inside: the area menu, Zoom to area and Copy image as PNG only', menu.join('|') === 'Zoom to area|Copy image as PNG', menu.join(' | '));
  await page.click('.m2-cx button:has-text("Copy image as PNG")'); await page.waitForTimeout(2500);
  var got = await page.evaluate(async function () {
    var it = (await navigator.clipboard.read())[0], bm = await createImageBitmap(await it.getType('image/png')); return bm.width + 'x' + bm.height;
  }).catch(function (e) { return 'error ' + e.message; });
  ok('Copy image as PNG of the area: a sharp picture', /^\d+x\d+$/.test(got) && +got.split('x')[0] > 500, got);
  var ar = await page.$eval('#m2-area', function (e) { var r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; });
  await page.mouse.click(cx, cy, { button: 'right' }); await page.waitForTimeout(300);
  await page.click('.m2-cx button:has-text("Zoom to area")'); await page.waitForTimeout(500);
  var z1 = await tf(), gone = await page.$eval('#m2-area', function (e) { return e.style.display === 'none'; });
  ok('Zoom to area: the map zoomed in and the area ended', z1 !== t0 && gone, t0 + ' -> ' + z1);
  // the area's middle now at the middle of the free part of the window: the picture point under the window's centre
  var mid = await page.evaluate(function () { var v = document.getElementById('m2-view').getBoundingClientRect(); return [v.left, v.top, v.width, v.height]; });
  console.log('      area width ' + Math.round(ar[2]) + ' px, view ' + Math.round(mid[2]) + ' px');
  await shiftDrag(cx - 150, cy - 120, cx + 150, cy + 120);
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
  if (await page.$('.m2-ri[data-win="edit"]:visible')) {
    await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(2500);
    var m0 = await tf();
    await page.mouse.move(v[0] + 40, v[1] + 40); await page.mouse.down(); await page.mouse.move(cx, cy, { steps: 6 });
    var noBand = !(await page.$('#m2-edit-layer .m2-ed-band'));
    await page.mouse.up(); await page.waitForTimeout(300);
    ok('edit mode: a drag moves the map, no band', noBand && (await tf()) !== m0, m0 + ' -> ' + (await tf()));
    ok('edit mode: a drag selects nothing', (await page.$$eval('#m2-edit-layer .m2-ed-handle', function (l) { return l.length; })) === 0);
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(v[0] + 40, v[1] + 40, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);   // the map back where it was
    await page.mouse.move(cx, cy); await page.keyboard.press('0'); await page.waitForTimeout(600);   // the whole map, so the area holds whole nodes
    var e0 = await tf(), sawBand = false;
    await page.keyboard.down('Shift');
    await page.mouse.move(v[0] + 40, v[1] + 40); await page.mouse.down(); await page.mouse.move(cx, cy, { steps: 6 });
    sawBand = !!(await page.$('#m2-edit-layer .m2-ed-band'));
    var bandFill = sawBand && await page.$eval('#m2-edit-layer .m2-ed-band', function (e) { return getComputedStyle(e).fill; });
    await page.mouse.move(v[0] + v[2] - 40, v[1] + v[3] - 40, { steps: 6 }); await page.mouse.up(); await page.keyboard.up('Shift'); await page.waitForTimeout(300);
    ok('edit mode: Shift with a drag draws the area band', sawBand);
    ok('edit mode: the band an outline only, no fill, as in view mode', bandFill === 'none', bandFill);
    ok('edit mode: Shift with a drag leaves the map still', (await tf()) === e0, e0 + ' -> ' + (await tf()));
    ok('edit mode: the viewer area stays hidden', await page.$eval('#m2-area', function (e) { return e.style.display !== 'block'; }));
    var sel = await page.$$eval('#m2-edit-layer .m2-ed-handle, #m2-edit-layer [class*="m2-ed-sel"]', function (l) { return l.length; });
    ok('edit mode: something selected by the area', sel > 0, 'marks ' + sel);
  } else console.log('      (no Edit tab on this page)');
  // Settings, Gestures: Drag selects an area ticked; a drag then selects an area in both modes; unticked again, back
  var p2 = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  p2.on('pageerror', function (e) { errs.push(e.message); });
  await p2.goto(URL0, { waitUntil: 'load' });
  await p2.waitForFunction(function () { var i = document.getElementById('m2-img'); return i && i.style.width; }, null, { timeout: 30000 }); await p2.waitForTimeout(2500);
  await p2.click('.m2-ri[data-win="set"]'); await p2.waitForTimeout(300);
  ok('Settings: Drag selects an area unticked at first, (recommended) in its name, no Default or Recommended buttons', await p2.evaluate(function () { var l = document.getElementById('m2-set-grab').closest('label'); return !document.getElementById('m2-set-grab').checked && !document.getElementById('m2-set-gest') && /Drag selects an area \(recommended\)/.test(l.textContent); }));
  await p2.click('#m2-setwin .m2-set-itip'); await p2.waitForTimeout(150);
  ok('Settings: the circled i opens a small window with why, 240 px, the tick box unchanged', await p2.evaluate(function () { var t = document.querySelector('.m2-ipop'); return t && /continuous motion/.test(t.textContent) && Math.round(t.getBoundingClientRect().width / (document.getElementById('m2-view').currentCSSZoom || 1)) === 240 && !document.getElementById('m2-set-grab').checked; }));
  var ipb = await p2.$eval('.m2-ipop', function (t) { var r = t.getBoundingClientRect(); return [r.left + 20, r.top + 10]; });
  await p2.mouse.click(ipb[0], ipb[1]); await p2.waitForTimeout(150);
  ok('Settings: a click inside the window keeps it', !!(await p2.$('.m2-ipop')));
  await p2.click('#m2-setwin .m2-set-itip'); await p2.waitForTimeout(150);
  ok('Settings: a second click on the i closes it', !(await p2.$('.m2-ipop')));
  await p2.click('#m2-setwin .m2-set-itip'); await p2.waitForTimeout(150);
  await p2.click('#m2-setwin .m2-set-k'); await p2.waitForTimeout(150);
  ok('Settings: a click elsewhere closes it', !(await p2.$('.m2-ipop')));
  await p2.click('#m2-setwin .m2-set-itip'); await p2.waitForTimeout(150); await p2.keyboard.press('Escape'); await p2.waitForTimeout(150);
  ok('Settings: Esc closes it', !(await p2.$('.m2-ipop')));
  ok('Settings: the box level with the first line of its name', await p2.evaluate(function () { var c = document.getElementById('m2-set-grab').getBoundingClientRect(), l = c.top + c.height / 2, sp = document.getElementById('m2-set-grab').nextElementSibling, r = document.createRange(); r.setStart(sp.firstChild, 0); r.setEnd(sp.firstChild, 1); var f = r.getBoundingClientRect(); return Math.abs(l - (f.top + f.height / 2)) <= 2; }));
  await p2.click('#m2-set-grab'); await p2.waitForTimeout(200);
  ok('Ticked: kept', await p2.evaluate(function () { return document.getElementById('m2-set-grab').checked && localStorage.getItem('atlas-drag-moves') === 'off'; }));
  var tf2 = function () { return p2.$eval('#m2-img', function (i) { return i.style.transform; }); }, w0 = await tf2();
  await p2.mouse.move(cx - 150, cy - 120); await p2.mouse.down(); await p2.mouse.move(cx + 150, cy + 120, { steps: 10 }); await p2.mouse.up();
  ok('Recommended, view mode: a drag selects an area, the map still', (await tf2()) === w0 && await p2.$eval('#m2-area', function (e) { return e.style.display === 'block'; }));
  if (await p2.$('.m2-ri[data-win="edit"]:visible')) {
    await p2.click('.m2-ri[data-win="edit"]'); await p2.waitForTimeout(2500);
    var w1 = await tf2();
    await p2.mouse.move(v[0] + 40, v[1] + 40); await p2.mouse.down(); await p2.mouse.move(cx, cy, { steps: 6 });
    var band2 = !!(await p2.$('#m2-edit-layer .m2-ed-band'));
    await p2.mouse.up(); await p2.waitForTimeout(300);
    ok('Recommended, edit mode: a drag draws the band, the map still', band2 && (await tf2()) === w1);
    await p2.click('.m2-ri[data-win="set"]'); await p2.waitForTimeout(300);
  }
  await p2.click('#m2-set-grab'); await p2.waitForTimeout(200);
  ok('Unticked again, the key gone', await p2.evaluate(function () { return !document.getElementById('m2-set-grab').checked && localStorage.getItem('atlas-drag-moves') === null; }));
  ok('no script errors', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
