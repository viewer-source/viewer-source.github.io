// A background image as a person handles it (on pdh-celldesigner), live: added
// by the panel's Upload; the pointer's sign on each kind of handle (resize) and inside where nothing else is (move); the
// image itself following a handle's drag and a move, not the outline alone; pulled past the map's top-left edge, so the
// map is shifted out of negative places: the outline and handles still on the image, the image where it was dropped, the
// layer text's own x and y the same as its bounds in the file; moved and resized after that shift; undone; added again
// on the shifted map. Before the fix the outline stayed where the map was before the shift and handles missed the image.
//   node tests/bg-drift-live.js [base address] [--local]   (--local: the editor and renderers of the working tree routed in)
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/', local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..'), bad = 0;
var ok = (w, v, m) => { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + w + (v ? '' : '  ' + (m || ''))); };
var SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><ellipse cx="200" cy="150" rx="195" ry="145" fill="#9cf" stroke="#369" stroke-width="8"/></svg>');
(async function () {
  var b = await chromium.launch(), page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  page.on('pageerror', e => { bad++; console.log('ERR', e.message); });
  if (local) { var ed = require(here + '/tests/editor-now.js')(here); await page.route(/\/editor\/editor\.js/, r => r.fulfill({ contentType: 'application/javascript', body: ed }));
    await page.route(/\/renderers\/converter\/[a-z_]+\.js/, r => { var f = new URL(r.request().url()).pathname.split('/').pop(); r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(here, 'renderers', 'converter', f), 'utf8') }); }); }
  await page.goto(base, { waitUntil: 'load' }); await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('atlas-edit-drafts'); });
  await page.goto('about:blank'); await page.goto(base + '#pdh-celldesigner', { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  if (!(await page.$('#m2-editwin button[data-make="cd:COMPARTMENT"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="cd:COMPARTMENT"]', { state: 'visible', timeout: 60000 }); await page.waitForTimeout(2000);
  var clear = async () => { while (await page.$('#m2-editwin tr.m2-ed-pbg:not([data-k="bgadd"]) .m2-ed-ppicoff')) { await page.click('#m2-editwin tr.m2-ed-pbg:not([data-k="bgadd"]) .m2-ed-ppicoff'); await page.waitForTimeout(1500); } };
  var add = async () => { var ch = page.waitForEvent('filechooser'); await page.click('#m2-editwin tr.m2-ed-pbg[data-k="bgadd"] button'); await (await ch).setFiles({ name: 'cell.svg', mimeType: 'image/svg+xml', buffer: SVG }); await page.waitForTimeout(2500); };
  await clear(); await add();
  var st = async () => page.evaluate(() => {
    var g = document.querySelector('#m2-view .m2-ed-ghost'), gr = g && g.getBoundingClientRect();
    var im = Array.prototype.filter.call(document.querySelectorAll('#m2-img image, #m2-img use'), i => i.getAttribute('pointer-events') === 'none').map(i => { var r = i.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    var hs = Array.prototype.map.call(document.querySelectorAll('#m2-view .m2-ed-handle'), h => { var r = h.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    return { ghost: gr && [gr.left, gr.top, gr.width, gr.height], img: im[0], hs: hs, n: im.length };
  });
  var agree = (s) => s.ghost && s.img && s.ghost.every((v, k) => Math.abs(v - s.img[k]) < 2);
  var text = () => page.evaluate(() => window.m2EditNow().text);
  var same = async () => { var t = await text(), m = /<celldesigner:layerSpeciesAlias x="([^"]*)" y="([^"]*)"[^>]*>[\s\S]*?<celldesigner:bounds x="([^"]*)" y="([^"]*)"/.exec(t); return m && +m[1] === +m[3] && +m[2] === +m[4] ? 'same' : JSON.stringify(m && m.slice(1)); };
  var drag = async (from, to, during) => { await page.mouse.move(from[0], from[1]); await page.mouse.down(); await page.mouse.move(to[0], to[1], { steps: 10 }); if (during) await during(); await page.mouse.up(); await page.waitForTimeout(2500); };
  var corner = (s, f) => s.hs.reduce((a, q) => !a || f(q) > f(a) ? q : a, null);
  var cur = async (p) => { await page.mouse.move(p[0] + 1, p[1] + 1); await page.mouse.move(p[0], p[1]); await page.waitForTimeout(150); return page.evaluate(() => document.getElementById('m2-view').style.cursor); };
  var s = await st(); ok('added: outline on the image', agree(s), JSON.stringify(s));
  var tl = corner(s, q => -q[0] - q[1]), br = corner(s, q => q[0] + q[1]), tr = corner(s, q => q[0] - q[1]);
  var rm = s.hs.filter(q => Math.abs(q[0] - br[0]) < 2).sort((a, c) => a[1] - c[1])[1], tm = s.hs.filter(q => Math.abs(q[1] - tl[1]) < 2).sort((a, c) => a[0] - c[0])[1];
  ok('cursor on the top-left handle: nwse-resize', (await cur(tl)) === 'nwse-resize', await cur(tl));
  ok('cursor on the top-right handle: nesw-resize', (await cur(tr)) === 'nesw-resize', await cur(tr));
  ok('cursor on the right middle handle: ew-resize', (await cur(rm)) === 'ew-resize', await cur(rm));
  ok('cursor on the top middle handle: ns-resize', (await cur(tm)) === 'ns-resize', await cur(tm));
  await drag(rm, [rm[0] + 120, rm[1]], async () => { var d = await st(); ok('during a handle drag: the image follows the outline', agree(d), JSON.stringify(d)); });
  s = await st(); ok('right handle: outline on the image', agree(s) && s.ghost[2] > 400, JSON.stringify(s));
  var inside = [s.ghost[0] + s.ghost[2] - 20, s.ghost[1] + s.ghost[3] / 2];   // in the part pulled out, past the network
  ok('cursor inside where nothing else is: move', (await cur(inside)) === 'move', await cur(inside));
  tl = corner(s, q => -q[0] - q[1]);
  await drag(tl, [tl[0] - 220, tl[1] - 180]);
  s = await st(); ok('top-left past the map edge (map shifted): outline on the image', agree(s), JSON.stringify(s));
  ok('top-left past the edge: on screen where dropped', Math.abs(s.ghost[0] - (tl[0] - 220)) < 8 && Math.abs(s.ghost[1] - (tl[1] - 180)) < 8, JSON.stringify([s.ghost, tl]));
  ok('the file: the text\'s x, y and its bounds agree', (await same()) === 'same', await same());
  inside = [s.ghost[0] + 25, s.ghost[1] + s.ghost[3] - 25];
  ok('after the shift, cursor inside: move', (await cur(inside)) === 'move', await cur(inside));
  await drag(inside, [inside[0] + 100, inside[1] + 50], async () => { var d = await st(); ok('during a move: the image follows', agree(d), JSON.stringify(d)); });
  s = await st(); ok('moved after the shift: outline on the image', agree(s), JSON.stringify(s));
  br = corner(s, q => q[0] + q[1]);
  ok('after the shift, cursor on the bottom-right handle: nwse-resize', (await cur(br)) === 'nwse-resize', await cur(br));
  await drag(br, [br[0] - 150, br[1] - 100]);
  s = await st(); ok('bottom-right pulled in after the shift: smaller, outline on the image', agree(s) && s.ghost[2] < 700, JSON.stringify(s));
  br = corner(await st(), q => q[0] + q[1]); var tb = await text();
  await drag(br, [br[0] + 90, br[1] + 60], async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); });
  s = await st(); var im0 = s.img;
  ok('Esc during a handle drag: nothing written, the image back on its box', (await text()) === tb && !s.ghost && Math.abs(im0[2] - (await (async () => { await page.click('#m2-editwin tr.m2-ed-pbg:not([data-k="bgadd"]) .m2-ed-ppicname'); await page.waitForTimeout(600); return (await st()).ghost[2]; })())) < 2, JSON.stringify(s));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(2000);
  s = await st(); ok('undone: outline on the image', !s.ghost || agree(s), JSON.stringify(s));
  await clear(); await add();
  s = await st(); ok('added on a shifted map: outline on the image', agree(s), JSON.stringify(s));
  console.log(bad ? bad + ' WRONG' : 'all ok'); await b.close(); process.exit(bad ? 1 : 0);
})();
