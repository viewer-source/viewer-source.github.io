// The canvas past its edge (editor core.js rebase, cdcreate.js cdMake): on Glycolysis (CellDesigner) a compartment dragged from
// the palette lands where it is released, also left of or above the canvas, and the map stays still on screen, also after
// a move past the edge left a shift pending; undo and redo across those shifts keep the map still; no negative place in
// the file. On Glycolysis (SBGN-ML) a node moved past the edge, undone and redone, the map still. Nothing is saved.
//   node tests/edge-shift.js [viewer folder: its editor served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var local = process.argv[2];
async function sbgn(page, ok) {   // a node moved past the edge on an SBGN-ML map, undone and redone
  await page.goto('https://viewer-source.github.io/styles/#glycolysis-sbgn', { waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  if (!(await page.$('#m2-editwin button[data-make]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2500);
  for (var i = 0; i < 2; i++) { await page.click("text=−"); await page.waitForTimeout(400); }
  var ids = await page.$$eval('#m2-img [data-n]', l => l.map(x => [x.getAttribute('data-n'), x.getBoundingClientRect().width, x.getBoundingClientRect().left]));
  ids.sort((a,c)=>a[2]-c[2]); var cand = ids.filter(x=>x[1]>30 && x[1] < 90); var lft = cand[0][0], ref = cand[cand.length-1][0];
  var box = async id => page.$eval('#m2-img [data-n="' + id + '"]', g => { var r = g.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; });
  var near = (a, c) => Math.abs(a[0]-c[0]) <= 3 && Math.abs(a[1]-c[1]) <= 3;
  var r0 = await box(ref), p = await box(lft), g = [p[0]+p[2]/2, p[1]+p[3]/2]; await page.mouse.click(g[0], g[1]); await page.waitForTimeout(500);
  await page.mouse.move(g[0], g[1]); await page.mouse.down(); await page.mouse.move(g[0]-200, g[1]-150, {steps:5}); await page.mouse.move(g[0]-400, g[1]-300, {steps:5}); await page.mouse.up(); await page.waitForTimeout(2500);
  ok('SBGN-ML: moved past the edge where released', near(await box(lft), [p[0]-400, p[1]-300]), JSON.stringify([await box(lft), p]));
  ok('SBGN-ML: map stays', near(await box(ref), r0));
  var lc = await page.evaluate(() => { var s = window.m2EditState && window.m2EditState(); return s && Object.keys(s).map(k => s[k] && s[k].lastChange).filter(Boolean)[0]; });   // the shift named (core.js render)
  ok('SBGN-ML: the shift named as a change', !!lc && lc.name === 'shift' && lc.shift && (lc.shift[0] > 0 || lc.shift[1] > 0), JSON.stringify(lc));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(2500);
  ok('SBGN-ML: undo: node back', near(await box(lft), p), JSON.stringify([await box(lft), p])); ok('SBGN-ML: undo: map stays', near(await box(ref), r0), JSON.stringify([await box(ref), r0]));
  await page.keyboard.press('Control+Shift+z'); await page.waitForTimeout(2500);
  ok('SBGN-ML: redo: node out again', near(await box(lft), [p[0]-400, p[1]-300])); ok('SBGN-ML: redo: map stays', near(await box(ref), r0), JSON.stringify([await box(ref), r0]));
}
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }));
  }
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('https://viewer-source.github.io/styles/#glycolysis-celldesigner', { waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  if (!(await page.$('#m2-editwin button[data-make="cd:COMPARTMENT"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="cd:COMPARTMENT"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  for (var i = 0; i < 2; i++) { await page.click("text=−"); await page.waitForTimeout(400); }
  var box = async id => page.$eval('#m2-img [data-n="' + id + '"]', g => { var r = g.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }).catch(()=>null);
  var all = () => page.$$eval('#m2-img [data-n]', l => l.map(x => x.getAttribute('data-n')));
  var sg = await page.$eval('#m2-editwin button[data-make="cd:COMPARTMENT"]', x => { var q = x.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  var bad = 0, ok = (w, v, m) => { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + w + ' ' + (m||'')); };
  var near = (a, b2) => Math.abs(a[0]-b2[0]) <= 3 && Math.abs(a[1]-b2[1]) <= 3;
  async function drop(T, tag) {
    var before = await all(), r0 = await box('sa_n1');
    await page.mouse.move(sg[0], sg[1]); await page.mouse.down(); await page.mouse.move(T[0]+50, T[1]+50, { steps: 6 }); await page.mouse.move(T[0], T[1], { steps: 8 });
    await page.mouse.up(); await page.waitForTimeout(2500);
    var nu = (await all()).filter(x => before.indexOf(x) < 0), q = await box(nu[0]), r1 = await box('sa_n1');
    var c = [q[0] + q[2]/2, q[1] + q[3]/2];
    ok(tag + ': dropped where released', near(c, T), JSON.stringify([c, T]));
    ok(tag + ': map stays', near(r0, r1), JSON.stringify([r0, r1]));
    return nu[0];
  }
  async function move(id, dx, dy, tag) {
    var r0 = await box('sa_n1'), p = await box(id); var g = [p[0]+3, p[1]+p[3]/2];
    await page.keyboard.press('Escape'); await page.mouse.click(g[0], g[1]); await page.waitForTimeout(300);   // selected first: a drag on a node not selected moves the map
    await page.mouse.move(g[0], g[1]); await page.mouse.down(); await page.mouse.move(g[0]+dx/2, g[1]+dy/2, {steps:5}); await page.mouse.move(g[0]+dx, g[1]+dy, {steps:5});
    await page.mouse.up(); await page.waitForTimeout(2500);
    var r1 = await box('sa_n1'), q = await box(id);
    ok(tag + ': moved where released', near(q, [p[0]+dx, p[1]+dy]), JSON.stringify([q, p]));
    ok(tag + ': map stays', near(r0, r1), JSON.stringify([r0, r1]));
  }
  async function key(k, tag) { var r0 = await box('sa_n1'); await page.keyboard.press(k); await page.waitForTimeout(2000); var r1 = await box('sa_n1'); ok(tag + ': map stays', near(r0, r1), JSON.stringify([r0, r1])); }
  var a = await drop([700, 400], 'A inside');
  await move(a, -400, 0, 'M1 left past edge');
  var c2 = await drop([300, 150], 'B up-left past edge');
  var d = await drop([250, 700], 'C left past edge');
  await key('Meta+z', 'undo C'); await key('Control+z', 'undo B'); await key('Control+Shift+z', 'redo B');
  var e = await drop([1200, 120], 'D above');
  var t = await page.evaluate(() => window.m2EditNow().text);
  ok('no negative place in the file', !/<celldesigner:bounds x="-|<celldesigner:bounds [^>]*y="-/.test(t));
  await sbgn(page, ok);
  console.log(bad ? bad + ' WRONG' : 'all ok');
  await b.close(); process.exit(bad ? 1 : 0);
})();
