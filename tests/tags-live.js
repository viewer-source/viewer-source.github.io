// Tags and submap terminals in the editor (create.js makeEntity, termsFix; core.js terminals, fixMoved; sbgn_edit way,
// terminal), on Testing Glycolysis SBGN-ML, Settings, Editing, CellDesigner compatible unticked: the palette's Tag and its
// SBGN extended mark; a submap made, a tag dropped on its right border becoming its terminal pointing right, one on its
// bottom border pointing down; a free tag made, turned up in Properties (Orientation), the terminal's Orientation greyed;
// the right terminal dragged down and out: it slides along the right side; dragged across to the left: it turns left;
// the submap dragged: its terminals go with it; the submap resized wider: the right terminal stays on its right side; a
// line from an entity to the free tag: an equivalence arc from the entity; one undo per step; CellDesigner compatible
// ticked: no Tag in the palette. Read from the SBGN-ML text the editor would save. Nothing is saved (no token). No
// script error.
//   node tests/tags-live.js [address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#glycolysis-sbgn', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
    await page.route('**/renderers/yrender/yrender.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/yrender/yrender.js'), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  var glyph = function (t, id) {   // [class, orientation, its parent's id, bbox x y w h] in the SBGN-ML text
    var m = new RegExp('<glyph [^>]*id="' + id + '"[^>]*>').exec(t);
    if (!m) return null;
    var tag = m[0], at = m.index, cls = /class="([^"]*)"/.exec(tag)[1], or = (/orientation="([^"]*)"/.exec(tag) || [])[1];
    var bb = /<bbox x="([^"]*)" y="([^"]*)" w="([^"]*)" h="([^"]*)"/.exec(t.slice(at)), up = null, depth = 0, re = /<(\/?)glyph\b[^>]*?(\/?)>/g, k;
    var head = t.slice(0, at), opens = [];
    while ((k = re.exec(head))) { if (k[1]) opens.pop(); else if (!k[2]) opens.push((/id="([^"]*)"/.exec(k[0]) || [])[1]); }
    up = opens.length ? opens[opens.length - 1] : null;
    return { cls: cls, way: or, up: up, box: bb ? bb.slice(1).map(Number) : null };
  };
  var make = async function (kind, x, y) {
    var b4 = await ids();
    await page.click('#m2-editwin button[data-make="' + kind + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(1200);
    return (await ids()).filter(function (z) { return b4.indexOf(z) < 0; })[0];
  };
  var drag = async function (from, to) {
    await page.mouse.move(from[0], from[1]); await page.mouse.down(); await page.mouse.move(from[0] + 6, from[1] + 6, { steps: 3 });
    await page.mouse.move(to[0], to[1], { steps: 10 }); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(1500);
  };
  var undo = async function () { await page.keyboard.press('Control+z'); await page.waitForTimeout(1500); };
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.removeItem('atlas-cd-compatible'); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-drag-moves', 'off'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="submap"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  ok('the palette offers Tag', await page.isVisible('#m2-editwin button[data-make="tag"]'));
  ok('the palette says SBGN extended', await page.isVisible('#m2-editwin .m2-ed-pext'));
  // a submap in empty room at the bottom right
  var sm = await make('submap', 1150, 760); await page.keyboard.press('Escape');
  ok('a submap made', !!sm);
  var S = await rect(sm);   // made larger, as submaps on maps are (a tag is 60 by 30)
  await page.mouse.click(S[0] + S[2] / 2, S[1] + S[3] / 2); await page.waitForTimeout(500);
  await page.fill('#m2-ed-w', '240'); await page.press('#m2-ed-w', 'Enter'); await page.waitForTimeout(1200);
  await page.fill('#m2-ed-h', '160'); await page.press('#m2-ed-h', 'Enter'); await page.waitForTimeout(1200);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  S = await rect(sm);
  // a tag on its right border: its terminal, pointing right
  var tr = await make('tag', S[0] + S[2] - 1, S[1] + S[3] / 2); await page.keyboard.press('Escape');
  var t1 = await now(), g = glyph(t1, tr);
  ok('a tag dropped on the right border is the submap’s terminal pointing right', !!g && g.cls === 'terminal' && g.way === 'right' && g.up === sm, JSON.stringify(g));
  var gs = glyph(t1, sm);
  ok('the terminal sits inside the submap on its right side', !!g && Math.abs(g.box[0] + g.box[2] - gs.box[0] - gs.box[2]) < 0.01, JSON.stringify([g && g.box, gs.box]));
  var tb = await make('tag', S[0] + S[2] / 2, S[1] + S[3] - 1); await page.keyboard.press('Escape');
  g = glyph(await now(), tb);
  ok('one dropped on the bottom border points down', !!g && g.cls === 'terminal' && g.way === 'down' && g.box[3] > g.box[2], JSON.stringify(g));
  // a free tag, turned up in Properties
  var tf = await make('tag', 1250, 180); await page.keyboard.press('Escape');
  g = glyph(await now(), tf);
  ok('a tag dropped on the map is a free tag pointing right', !!g && g.cls === 'tag' && g.way === 'right' && !g.up, JSON.stringify(g));
  var F = await rect(tf); await page.mouse.click(F[0] + F[2] / 2, F[1] + F[3] / 2); await page.waitForTimeout(800);
  ok('Properties shows Orientation for a tag', await page.isVisible('#m2-ed-way'));
  ok('its Orientation can be set', !(await page.isDisabled('#m2-ed-way')));
  await page.selectOption('#m2-ed-way', 'up'); await page.waitForTimeout(1500);
  g = glyph(await now(), tf);
  ok('turned up from Properties', !!g && g.way === 'up', JSON.stringify(g));
  await undo(); g = glyph(await now(), tf);
  ok('one undo turns it back', !!g && g.way === 'right', JSON.stringify(g));
  await page.keyboard.press('Escape');
  var R = await rect(tr); await page.mouse.click(R[0] + R[2] / 2, R[1] + R[3] / 2); await page.waitForTimeout(800);
  ok('a terminal’s Orientation is greyed (set by its side)', await page.isDisabled('#m2-ed-way'));
  // the right terminal dragged down and to the right: it slides along the right side
  var before = glyph(await now(), tr).box;
  await drag([R[0] + R[2] / 2, R[1] + R[3] / 2], [R[0] + R[2] / 2 + 30, R[1] + R[3] / 2 + 12]);
  g = glyph(await now(), tr); gs = glyph(await now(), sm);
  ok('dragged off, it slides along the right side (lower, still on it)', !!g && g.box[1] > before[1] + 5 && Math.abs(g.box[0] + g.box[2] - gs.box[0] - gs.box[2]) < 0.01 && g.way === 'right', JSON.stringify([before, g && g.box]));
  await undo(); g = glyph(await now(), tr);
  ok('one undo puts it back', !!g && JSON.stringify(g.box) === JSON.stringify(before), JSON.stringify(g && g.box));
  // dragged across to the left side: it turns left
  R = await rect(tr); S = await rect(sm);
  await page.mouse.click(R[0] + R[2] / 2, R[1] + R[3] / 2); await page.waitForTimeout(500);
  await drag([R[0] + R[2] / 2, R[1] + R[3] / 2], [S[0] + 4, R[1] + R[3] / 2]);
  g = glyph(await now(), tr); gs = glyph(await now(), sm);
  ok('dragged to the left side, it points left there', !!g && g.way === 'left' && Math.abs(g.box[0] - gs.box[0]) < 0.01, JSON.stringify(g));
  // the submap dragged: its terminals go with it
  var T0 = await now(), a0 = glyph(T0, tr).box, b0 = glyph(T0, tb).box, s0 = glyph(T0, sm).box;
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  S = await rect(sm); var SP = [S[0] + S[2] * 0.6, S[1] + S[3] * 0.3]; await page.mouse.click(SP[0], SP[1]); await page.waitForTimeout(500);
  await drag(SP, [SP[0] - 80, SP[1] - 30]);
  var T1 = await now(), s1 = glyph(T1, sm).box, a1 = glyph(T1, tr).box, b1 = glyph(T1, tb).box, dx = s1[0] - s0[0], dy = s1[1] - s0[1];
  ok('the submap moved', Math.abs(dx) > 10, JSON.stringify([s0, s1]));
  ok('its terminals moved with it', Math.abs(a1[0] - a0[0] - dx) < 0.01 && Math.abs(a1[1] - a0[1] - dy) < 0.01 && Math.abs(b1[0] - b0[0] - dx) < 0.01 && Math.abs(b1[1] - b0[1] - dy) < 0.01, JSON.stringify([dx, dy, a0, a1, b0, b1]));
  // the submap made wider in Properties: the bottom terminal stays on the bottom side
  await page.fill('#m2-ed-w', String(Math.round(s1[2] + 80))); await page.press('#m2-ed-w', 'Enter'); await page.waitForTimeout(1500);
  var T2 = await now(), s2 = glyph(T2, sm).box, b2 = glyph(T2, tb).box, a2 = glyph(T2, tr).box;
  ok('the submap made wider', s2[2] > s1[2] + 70, JSON.stringify(s2));
  ok('its bottom terminal stays on the bottom side, its left one on the left', Math.abs(b2[1] + b2[3] - s2[1] - s2[3]) < 0.01 && Math.abs(a2[0] - s2[0]) < 0.01, JSON.stringify([s2, a2, b2]));
  await page.keyboard.press('Escape');
  // a line from an entity of the map to the free tag: an equivalence arc from the entity
  var ent = await page.evaluate(function () { var t = window.m2EditNow().text, m = /<glyph [^>]*class="macromolecule"[^>]*id="([^"]*)"|<glyph [^>]*id="([^"]*)"[^>]*class="macromolecule"/.exec(t); return m ? m[1] || m[2] : null; });
  var E = await rect(ent); F = await rect(tf);
  await page.click('#m2-editwin button[data-make="consumption"]');
  await page.mouse.move(E[0] + E[2] / 2, E[1] + E[3] / 2); await page.mouse.down(); await page.mouse.move(E[0] + E[2] / 2 + 8, E[1] + E[3] / 2 + 20, { steps: 4 });
  await page.mouse.move(F[0] + F[2] / 2, F[1] + F[3] / 2, { steps: 12 }); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(1500);
  var T3 = await now(), arc = new RegExp('<arc [^>]*class="equivalence arc"[^>]*source="' + ent + '"[^>]*target="' + tf + '"').test(T3) || new RegExp('<arc [^>]*source="' + ent + '"[^>]*target="' + tf + '"[^>]*class="equivalence arc"').test(T3);
  ok('a line from an entity to the tag is an equivalence arc from the entity', arc, (T3.match(/<arc [^>]*class="equivalence arc"[^>]*>/g) || []).slice(-2).join(' '));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  // CellDesigner compatible ticked: no Tag
  await page.evaluate(function () { localStorage.setItem('atlas-cd-compatible', 'on'); });
  await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(300); await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(1500);
  ok('CellDesigner compatible ticked: no Tag in the palette', !(await page.isVisible('#m2-editwin button[data-make="tag"]')) && !(await page.isVisible('#m2-editwin .m2-ed-pext')));
  ok('the map holds what was made (tags kept)', /class="terminal"/.test(await now()) && !/undefined/.test(await now()));
  ok('no script error', errs.length === 0, errs.join(' | '));
  await page.evaluate(function () { localStorage.removeItem('atlas-cd-compatible'); });
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok'); process.exit(bad ? 1 : 0);
})();
