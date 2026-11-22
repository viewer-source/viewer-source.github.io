// A submap's terminal moved by the arrow keys and by hand (create.js keyTake, onSide; core.js keyTake, the selection's
// shade), on Testing Glycolysis SBGN-ML with CellDesigner compatible unticked: a submap made, a tag dropped on its right
// border (its terminal, pointing left); Up held: it slides up the right side, turns at the top right corner onto the top
// side (pointing down) and goes on leftwards, never leaving the submap's box; Left on the top side goes left, Right comes
// back; a run of keys is one undo step; dragged along its side near a corner it is dropped as shown during the drag; a resize of the submap keeps a terminal at a corner on its side. No grey
// fill over the terminal selected, at rest or dragged (the handles alone). No script error.
//   node tests/terminal-keys.js [address] [viewer folder: its editor served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#glycolysis-sbgn', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  var glyph = function (t, id) {
    var m = new RegExp('<glyph [^>]*id="' + id + '"[^>]*>').exec(t);
    if (!m) return null;
    var bb = /<bbox x="([^"]*)" y="([^"]*)" w="([^"]*)" h="([^"]*)"/.exec(t.slice(m.index));
    return { way: (/orientation="([^"]*)"/.exec(m[0]) || [])[1], cls: /class="([^"]*)"/.exec(m[0])[1], box: bb.slice(1).map(Number) };
  };
  var make = async function (kind, x, y) {
    var b4 = await ids();
    await page.click('#m2-editwin button[data-make="' + kind + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(1200);
    return (await ids()).filter(function (z) { return b4.indexOf(z) < 0; })[0];
  };
  var within = function (g, s) { return g.box[0] >= s.box[0] - 0.01 && g.box[1] >= s.box[1] - 0.01 && g.box[0] + g.box[2] <= s.box[0] + s.box[2] + 0.01 && g.box[1] + g.box[3] <= s.box[1] + s.box[3] + 0.01; };
  var hold = async function (key, n) {   // a key held: n repeats
    await page.keyboard.down(key);
    for (var k = 0; k < n; k++) await page.evaluate(function (key) { document.dispatchEvent(new KeyboardEvent('keydown', { key: key, repeat: true, bubbles: true, cancelable: true })); }, key);
    await page.keyboard.up(key); await page.waitForTimeout(600);
  };
  var greys = function () { return page.$$eval('#m2-img .m2-ed-dark', function (l) { return l.length; }); };   // grey fills put over selected nodes
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.removeItem('atlas-cd-compatible'); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-drag-moves', 'off'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="submap"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  var sm = await make('submap', 1150, 760); await page.keyboard.press('Escape');
  var S = await rect(sm);
  await page.mouse.click(S[0] + S[2] / 2, S[1] + S[3] / 2); await page.waitForTimeout(500);
  await page.fill('#m2-ed-w', '240'); await page.press('#m2-ed-w', 'Enter'); await page.waitForTimeout(1200);
  await page.fill('#m2-ed-h', '160'); await page.press('#m2-ed-h', 'Enter'); await page.waitForTimeout(1200);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  S = await rect(sm);
  var tr = await make('tag', S[0] + S[2] - 1, S[1] + S[3] / 2); await page.keyboard.press('Escape');
  var t0 = await now(), s0 = glyph(t0, sm), g0 = glyph(t0, tr);
  ok('the tag is the submap’s terminal on its right side, pointing left', g0 && g0.cls === 'terminal' && g0.way === 'left', JSON.stringify(g0));
  // the shade while dragged: the same colour as at rest
  var T = await rect(tr); await page.mouse.click(T[0] + T[2] / 2, T[1] + T[3] / 2); await page.waitForTimeout(600);
  var rest = await greys();
  T = await rect(tr); var c = [T[0] + T[2] / 2, T[1] + T[3] / 2];
  await page.mouse.move(c[0], c[1]); await page.mouse.down(); await page.mouse.move(c[0], c[1] + 6, { steps: 3 }); await page.mouse.move(c[0], c[1] + 20, { steps: 6 }); await page.waitForTimeout(300);
  var dragged = await greys();
  await page.mouse.move(c[0] + 200, c[1] + 20, { steps: 6 }); await page.waitForTimeout(300);   // out of the submap: still held on its border
  var dragged2 = await greys();
  await page.mouse.up(); await page.waitForTimeout(1500);
  ok('no grey fill over the selected terminal at rest', rest === 0, rest);
  ok('nor while dragged along its side or off its submap', dragged === 0 && dragged2 === 0, [dragged, dragged2].join());
  ok('after the drag it is on the right side still', glyph(await now(), tr).way === 'left');
  // dragged straight up along its side to just below the top: shown during the drag as it is dropped
  var g1 = glyph(await now(), tr), zoom = (await rect(sm))[2] / s0.box[2];
  T = await rect(tr); c = [T[0] + T[2] / 2, T[1] + T[3] / 2];
  await page.mouse.move(c[0], c[1]); await page.mouse.down(); await page.mouse.move(c[0], c[1] - 6, { steps: 3 });
  await page.mouse.move(c[0], c[1] - (g1.box[1] - s0.box[1] - 3) * zoom, { steps: 8 }); await page.waitForTimeout(300);
  var M = await rect(tr), shownFlat = M[2] > M[3];
  await page.mouse.up(); await page.waitForTimeout(1500);
  var g2 = glyph(await now(), tr);
  ok('dragged up along its side near the corner: dropped as shown during the drag', (g2.way === 'left') === shownFlat, JSON.stringify([M, g2]));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1200);
  T = await rect(tr); await page.mouse.click(T[0] + T[2] / 2, T[1] + T[3] / 2); await page.waitForTimeout(500);
  // Up held: up the right side, round the corner, along the top
  await page.mouse.move(10, 10);
  var steps = 0, seen = [], left = true, g;
  for (var k = 0; k < 40; k++) {
    await page.keyboard.press('Shift+ArrowUp'); steps++;
    g = glyph(await now(), tr); seen.push(g.way);
    if (!within(g, s0)) { left = false; break; }
  }
  ok('Shift+Up (pressed again and again) keeps it inside the submap', left, JSON.stringify(g));
  ok('it turned at the top right corner onto the top side, pointing down', seen.indexOf('down') > 0 && seen.slice(0, seen.indexOf('down')).every(function (w) { return w === 'left'; }), seen.join(','));
  g = glyph(await now(), tr);
  ok('on the top side it has its back on the top border', g.way === 'down' && Math.abs(g.box[1] - s0.box[1]) < 0.01 && g.box[3] > g.box[2], JSON.stringify(g));
  var x1 = g.box[0];
  await page.keyboard.press('ArrowLeft'); g = glyph(await now(), tr);
  ok('Left on the top side moves it left by 1', Math.abs(g.box[0] - (x1 - 1)) < 0.01, JSON.stringify(g));
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); g = glyph(await now(), tr);
  ok('Right moves it right', Math.abs(g.box[0] - (x1 + 1)) < 0.01, JSON.stringify(g));
  // held Down from the top side near the right corner: a key across the side goes clockwise inward... held, round to the right side
  await page.waitForTimeout(900);
  g = glyph(await now(), tr);
  await hold('ArrowRight', Math.round(s0.box[0] + s0.box[2] - g.box[2] - g.box[0]) + 20); g = glyph(await now(), tr);
  ok('Right held runs it round the top right corner down the right side', g.way === 'left' && within(g, s0), JSON.stringify(g));
  // undo: a run of keys is one step
  await page.waitForTimeout(900);
  var before = await now();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1200);
  ok('a run of keys is undone in one step', glyph(await now(), tr).box.join() === glyph(before, tr).box.join());
  // a terminal at the top right corner of the right side kept there when the submap is resized
  T = await rect(tr); await page.mouse.click(T[0] + T[2] / 2, T[1] + T[3] / 2); await page.waitForTimeout(500); await page.mouse.move(10, 10);   // undo leaves nothing selected
  g = glyph(await now(), tr);
  for (k = 0; k < 60 && g.way === 'left' && g.box[1] >= s0.box[1] + 1; k++) { await page.keyboard.press('ArrowUp'); g = glyph(await now(), tr); }
  ok('Up brings it to the top end of the right side', g.way === 'left' && g.box[1] - s0.box[1] < 1 && g.box[1] >= s0.box[1] - 0.01, JSON.stringify(g));
  await page.keyboard.press('Escape'); await page.waitForTimeout(900);
  S = await rect(sm); await page.mouse.click(S[0] + S[2] / 2, S[1] + S[3] / 2); await page.waitForTimeout(500);
  await page.fill('#m2-ed-w', '260'); await page.press('#m2-ed-w', 'Enter'); await page.waitForTimeout(1500);
  g = glyph(await now(), tr); var s1 = glyph(await now(), sm);
  ok('the submap resized wider: the corner terminal stays on the right side', g.way === 'left' && Math.abs(g.box[0] + g.box[2] - s1.box[0] - s1.box[2]) < 0.01, JSON.stringify([g, s1]));
  ok('no script error', !errs.length, errs.join(' / '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
