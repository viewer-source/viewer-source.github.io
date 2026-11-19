// The palette's Colours recolours the whole map (create.js sbRecolour, cdcreate.js cdRecolour): on the styles page, on
// SREBP signalling as CellDesigner and as SBGN-ML, each in a fresh page: Default gives every protein and metabolite the
// Default colours, No colours every species white, Confetti every protein a colour of its own, From map leaves the map,
// one undo takes a choice back. Read from the editor's drawing (the role classes c-<role>). Nothing is saved (no token).
//   node tests/colours-whole-map.js [base address] [viewer folder: its editor served in place of the page's]
var chromium = require('playwright').chromium, fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3], bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
async function run(b, map, kind, protein, link) {
  var page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [];
  if (local) {
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route(/\/renderers\/converter\/(sbgn_edit|cd_make)\.js/, function (r) { var f = /(sbgn_edit|cd_make)\.js/.exec(r.request().url())[0]; r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', f), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.goto(base + '#' + map, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.removeItem('atlas-edit-map-choices'); });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  var fills = function () { return page.evaluate(function () {
    var d = new DOMParser().parseFromString(window.m2EditNow().svg, 'image/svg+xml'), o = {};
    Array.from(d.querySelectorAll('[class]')).forEach(function (e) { var m = /\bc-(\w+)/.exec(e.getAttribute('class')); if (m && e.getAttribute('fill')) (o[m[1]] = o[m[1]] || []).push(e.getAttribute('fill').toLowerCase()); });
    return o;
  }); };
  var strokes = function () { return page.evaluate(function () {   // the drawing's line colours but black, white and none
    var d = new DOMParser().parseFromString(window.m2EditNow().svg, 'image/svg+xml'), o = {};
    Array.from(d.querySelectorAll('[stroke]')).forEach(function (e) { var c = e.getAttribute('stroke').toLowerCase(); if (!/^(none|#000|#000000|#fff|#ffffff|white|black)$/.test(c)) o[c] = (o[c] || 0) + 1; });
    return o;
  }); };
  var text = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var pick = async function (name) { await page.click('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd'); await page.waitForTimeout(200); await page.click('body > .m2-ed-pdl button:has-text("' + name + '")'); await page.waitForTimeout(2500); };
  var t0 = await text(), f0 = await fills();
  ok(kind + ': proteins drawn', (f0.protein || []).length > 5, JSON.stringify(Object.keys(f0)));
  await pick('Default'); var f = await fills();
  ok(kind + ': Default, every protein #c8d8eb', (f.protein || []).length > 0 && f.protein.every(function (x) { return x === '#c8d8eb'; }), Array.from(new Set(f.protein)).join(' '));
  ok(kind + ': Default, every metabolite #dbebdb', (f.metabolite || []).every(function (x) { return x === '#dbebdb'; }), Array.from(new Set(f.metabolite || [])).join(' '));
  var sd = await strokes(); delete sd['#dfdbce'];   // a CellDesigner compartment's lines drawn in its Default paint
  ok(kind + ': Default, every line and border black', Object.keys(sd).length === 0, JSON.stringify(sd));
  ok(kind + ': the file changed', (await text()) !== t0);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(2500);
  ok(kind + ': one undo, the file as it was', (await text()) === t0);
  await pick('No colours'); f = await fills();
  var all = [].concat(f.protein, f.metabolite || [], f.complex || []);
  ok(kind + ': No colours, every species white', all.every(function (x) { return /^#f{3}(f{3})?$|^white$/.test(x); }), Array.from(new Set(all)).join(' '));
  ok(kind + ': No colours, every line and border black', Object.keys(await strokes()).length === 0, JSON.stringify(await strokes()));
  await pick('Confetti'); f = await fills();
  ok(kind + ': Confetti, the proteins of many colours', new Set(f.protein).size > f.protein.length / 2, new Set(f.protein).size + ' of ' + f.protein.length);
  var sk = await strokes();
  ok(kind + ': Confetti, the lines of many colours', Object.keys(sk).length > 10, Object.keys(sk).length + ' colours');
  // a new line under Confetti: two new proteins joined, its colour one the map had not
  var ids = async function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var at = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
  var made = [];
  for (var q = 0; q < 2; q++) { var b4 = await ids(); await page.click('#m2-editwin button[data-make="' + protein + '"]'); await page.mouse.click(1150 + q * 180, 820); await page.waitForTimeout(900); await page.keyboard.press('Escape'); made.push((await ids()).filter(function (x) { return b4.indexOf(x) < 0; })[0]); }
  var A = await at(made[0]), B = await at(made[1]);
  await page.click('#m2-editwin button[data-make="' + link + '"]');
  await page.mouse.move(A[0], A[1]); await page.mouse.down(); await page.mouse.move(A[0] + 8, A[1] + 25, { steps: 4 }); await page.mouse.move(B[0], B[1], { steps: 8 }); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(1500);
  var sk2 = await strokes(), fresh = Object.keys(sk2).filter(function (c) { return !sk[c]; });
  ok(kind + ': a new line under Confetti a colour of its own', fresh.length >= 1, fresh.join(' '));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  var t1 = await text(); await pick('From map');
  ok(kind + ': From map leaves the map', (await text()) === t1);
  ok(kind + ': no script error', errs.length === 0, errs.join(' | '));
  await page.close();
}
(async function () {
  var b = await chromium.launch();
  await run(b, 'srebp-celldesigner', 'CellDesigner', 'cd:PROTEIN', 'cd:STATE_TRANSITION');
  await run(b, 'srebp-sbgn', 'SBGN-ML', 'macromolecule', 'production');
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok'); process.exit(bad ? 1 : 0);
})();
