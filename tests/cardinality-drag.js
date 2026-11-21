// A cardinality dragged along its line (create.js cardDown, cardMarks, cardUp, keys; sbgn_edit countsAt, countMove,
// countsPlace; the converter's count_place): on the styles page, Testing Glycolysis (SBGN-ML), a consumption given 2:
// a click on its box selects it (four squares, the line's Properties with Cardinality); a drag moves it along the line
// (the box drawn by the drop, its glyph's bbox written); dragged far past an end it stops short of it; across the line it
// goes to the other side; Esc during a drag changes nothing; the arrow keys move it; the process moved, it stays on its
// line; Delete takes it out, its line kept; undo brings each back; the converter reads the bbox written as the same place.
// CellDesigner (Testing Glycolysis): a click on a reactant's box selects its line, a drag says why it stays and changes
// nothing, Delete then takes out the number (not the line). Nothing is saved (no token). No script error.
//   node tests/cardinality-drag.js [base address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  if (local) {
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var type = async function (k, v) { await page.fill('#m2-ed-' + k, v); await page.press('#m2-ed-' + k, 'Enter'); await page.waitForTimeout(1200); };
  var shown = function (k) { return page.$eval('#m2-ed-' + k, function (f) { return !f.closest('tr').hidden && !f.closest('[hidden]') ? f.value : null; }).catch(function () { return null; }); };
  var open = async function (hash, mark) {
    await page.goto('about:blank'); await page.goto(base + '#' + hash, { waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    if (!(await page.$('#m2-editwin button[data-make="' + mark + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + mark + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var lineAt = function (id) { return page.evaluate(function (id) {
    var all = []; document.querySelectorAll('#m2-img [data-e="' + id + '"]').forEach(function (g) { all.push(g); g.querySelectorAll('*').forEach(function (c) { all.push(c); }); });
    var q = all.filter(function (x) { return x.getTotalLength; }).sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0], pt = q.getPointAtLength(q.getTotalLength() / 2), m = q.getScreenCTM();
    return [m.a * pt.x + m.c * pt.y + m.e, m.b * pt.x + m.d * pt.y + m.f]; }, id); };
  var path2 = function (id) { return page.evaluate(function (id) {   // the line on screen, sampled
    var all = []; document.querySelectorAll('#m2-img [data-e="' + id + '"]').forEach(function (g) { g.querySelectorAll('path, line, polyline').forEach(function (c) { all.push(c); }); });
    var q = all.sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0], m = q.getScreenCTM(), L = q.getTotalLength(), out = [];
    for (var i = 0; i <= 200; i++) { var p = q.getPointAtLength(L * i / 200); out.push([m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]); }
    return out; }, id); };
  var boxAt = function (id) { return page.evaluate(function (id) {   // the drawn box's centre on screen, null for none
    var r = Array.prototype.filter.call(document.querySelectorAll('#m2-img [data-e="' + id + '"] rect'), function (x) { return (x.getAttribute('stroke') || '').toLowerCase() === '#9aa0a6' && x.style.visibility !== 'hidden'; })[0];
    if (!r) return null; var q = r.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, id); };
  var handles = function () { return page.$$eval('.m2-ed-handle', function (l) { return l.length; }); };
  var nearest = function (pts, P) { var best = [Infinity, 0, 0]; pts.forEach(function (p, i) { var d = Math.hypot(p[0] - P[0], p[1] - P[1]); if (d < best[0]) best = [d, i, 0]; }); var i = best[1], a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)]; best[2] = Math.sign((c[0] - a[0]) * (P[1] - pts[i][1]) - (c[1] - a[1]) * (P[0] - pts[i][0])); return best; };
  var bbox = function (t, a) { var m = new RegExp('<(?:\\w+:)?arc\\b[^>]*\\bid="' + a + '"[\\s\\S]*?</(?:\\w+:)?arc>').exec(t); var c = m && /class="cardinality"[\s\S]*?<(?:\w+:)?bbox ([^>]*)\/>/.exec(m[0]); return c ? c[1] : null; };
  var drag = async function (from, to, esc) {
    await page.mouse.move(from[0], from[1]); await page.mouse.down();
    for (var i = 1; i <= 8; i++) await page.mouse.move(from[0] + (to[0] - from[0]) * i / 8, from[1] + (to[1] - from[1]) * i / 8);
    if (esc) await page.keyboard.press('Escape');
    await page.mouse.up(); await page.waitForTimeout(1200);
  };
  var undo = async function () { await page.keyboard.press('Control+z'); await page.waitForTimeout(1200); };

  await open('glycolysis-sbgn', 'compartment');
  var t0 = await now(), ids = await page.$$eval('#m2-img [data-e]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-e'); }))); });
  var cons = (t0.match(/<(?:\w+:)?arc\b[^>]*class="consumption"[^>]*>/g) || []).map(function (a) { return /\bid="([^"]+)"/.exec(a)[1]; }).filter(function (a) { return ids.indexOf(a) >= 0; });
  var A = await page.evaluate(function (as) { var len = function (a) { var g = document.querySelector('#m2-img [data-e="' + a + '"] path'); return g && g.getTotalLength ? g.getTotalLength() : 0; }; return as.sort(function (u, v) { return len(v) - len(u); })[0]; }, cons);
  await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.mouse.click.apply(page.mouse, await lineAt(A)); await page.waitForTimeout(600);
  await type('card', '2');
  var t1 = await now(), B0 = await boxAt(A), L = await path2(A);
  ok('a box drawn for 2', !!B0);
  await page.mouse.click(10, 880); await page.waitForTimeout(400);
  await page.mouse.click(B0[0], B0[1]); await page.waitForTimeout(600);
  ok('a click on the box selects it (four squares)', (await handles()) === 4, String(await handles()));
  ok('its line\'s Properties with Cardinality 2', (await shown('card')) === '2', await shown('card'));
  var to = L[40], side0 = nearest(L, B0)[2];
  await drag(B0, to);
  var t2 = await now(), B1 = await boxAt(A);
  ok('dragged: the bbox written anew', bbox(t2, A) && bbox(t2, A) !== bbox(t1, A), bbox(t2, A));
  ok('dragged: drawn by the drop', B1 && Math.hypot(B1[0] - to[0], B1[1] - to[1]) < 14, JSON.stringify([B1, to]));
  ok('dragged: still beside its line', B1 && nearest(await path2(A), B1)[0] < 12);
  ok('dragged: the rest of the file as it was', t2.replace(/<(?:\w+:)?bbox [^>]*\/>/g, '') === t1.replace(/<(?:\w+:)?bbox [^>]*\/>/g, '') && t2.replace(/\s*<glyph class="cardinality"[\s\S]*?<\/glyph>/g, '') === t1.replace(/\s*<glyph class="cardinality"[\s\S]*?<\/glyph>/g, ''));
  ok('still selected after the drag', (await handles()) === 4, String(await handles()));
  var far = [L[0][0] + (L[0][0] - L[10][0]) * 20, L[0][1] + (L[0][1] - L[10][1]) * 20];
  await drag(B1, far);
  var B2 = await boxAt(A), n2 = nearest(await path2(A), B2);
  ok('dragged past the end: stops short of it, beside the line', n2[0] < 12 && n2[1] > 0, JSON.stringify(n2));
  var mid = L[100], nrm = [L[102][1] - L[98][1], -(L[102][0] - L[98][0])], nl = Math.hypot(nrm[0], nrm[1]) || 1, B2b = await boxAt(A);
  var cross = [mid[0] + side0 * nrm[0] / nl * 25, mid[1] + side0 * nrm[1] / nl * 25];   // nearest()'s side -side0
  await drag(B2b, cross);
  var B3 = await boxAt(A), n3 = nearest(await path2(A), B3);
  ok('dragged across the line: on the other side', n3[2] === -side0 && n3[0] < 12, JSON.stringify([n3, side0]));
  var t3 = await now();
  await drag(B3, L[150], true);
  ok('Esc during a drag: nothing changed', (await now()) === t3);
  ok('Esc: drawn where it was', Math.hypot((await boxAt(A))[0] - B3[0], (await boxAt(A))[1] - B3[1]) < 1);
  var B4 = await boxAt(A);
  for (var i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown'); }
  await page.waitForTimeout(1200);
  ok('the arrow keys move it along its line', bbox(await now(), A) !== bbox(t3, A) && Math.hypot((await boxAt(A))[0] - B4[0], (await boxAt(A))[1] - B4[1]) > 1);
  // an arrow nearer across the line takes it to the other side
  var Ls = await path2(A), Bk = await boxAt(A), nk = nearest(Ls, Bk), i0 = Math.max(1, Math.min(199, nk[1])), ux = Ls[i0 + 1][0] - Ls[i0 - 1][0], uy = Ls[i0 + 1][1] - Ls[i0 - 1][1];
  var keys = [['ArrowLeft', -1, 0], ['ArrowRight', 1, 0], ['ArrowUp', 0, -1], ['ArrowDown', 0, 1]].filter(function (k) { return Math.abs(k[1] * uy - k[2] * ux) > Math.abs(k[1] * ux + k[2] * uy); });
  var away = keys.filter(function (k) { return Math.sign(ux * k[2] - uy * k[1]) === -nk[2]; })[0];
  await page.keyboard.press(away[0]); await page.waitForTimeout(1200);
  var nk2 = nearest(await path2(A), await boxAt(A));
  ok('an arrow across the line (' + away[0] + '): on the other side', nk2[2] === -nk[2] && nk2[0] < 12, JSON.stringify([nk, nk2]));
  // the place in the file read by the converter as the editor shows it
  var tmp = path.join(require('os').tmpdir(), 'card-drag.sbgn'); fs.writeFileSync(tmp, await now());
  var py = cp.execFileSync('python3', ['-c', 'import sys; sys.path.insert(0, sys.argv[2]); from mapconv import sbgnml; m = sbgnml.read(sys.argv[1]); print([a.count_at for a in m.arcs if a.id == sys.argv[3]][0])', tmp, path.join(local || __dirname + '/..', 'renderers/converter'), A]).toString().trim();
  ok('the converter reads the written box as a place along the line', /^\(0\.\d+, -?1\)$/.test(py), py);
  var steps = 0;
  while ((await now()) !== t1 && steps < 12) { await undo(); steps++; }
  ok('undone step by step (' + steps + ' steps: each drag and each arrow that moved it one): the box back at the middle, as typed', (await now()) === t1 && steps >= 4, steps + ' ' + bbox(await now(), A));
  // the process moved: the box stays by its line
  await page.keyboard.press('Escape'); await page.mouse.click(10, 880);
  await page.mouse.click(B0[0], B0[1]); await page.waitForTimeout(400);
  await drag(B0, L[170]);   // near the process, so the process's move takes the line far under it
  var pr = /target="([^"]+)"/.exec(new RegExp('<(?:\\w+:)?arc\\b[^>]*\\bid="' + A + '"[^>]*>').exec(t0)[0])[1];
  var proc = await page.evaluate(function (id) { var g = document.querySelector('#m2-img [data-n="' + id + '"]') || document.querySelector('#m2-img [data-n="' + id.replace(/\.[^.]*$/, '') + '"]'); if (!g) return null; var q = g.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, pr);
  if (proc) {
    await page.mouse.click(10, 880); await page.mouse.click(proc[0], proc[1]); await page.waitForTimeout(400);
    var Bp = await boxAt(A);
    for (var j = 0; j < 6; j++) await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(1500);
    var B5 = await boxAt(A), n5 = B5 && nearest(await path2(A), B5);
    ok('the process moved: the box moved with its line, still by it', B5 && Math.hypot(B5[0] - Bp[0], B5[1] - Bp[1]) > 20 && n5[0] < 12 && n5[1] > 120, JSON.stringify([Bp, B5, n5]));
    await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.waitForTimeout(300);
    await page.mouse.click(B5[0], B5[1]); await page.waitForTimeout(500);
    var hs = await page.$$eval('.m2-ed-handle', function (l) { return l.map(function (h) { var q = h.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }); });
    ok('the process moved: a click on the drawn box selects it, its squares round it', hs.length === 4 && hs.every(function (h) { return Math.hypot(h[0] - B5[0], h[1] - B5[1]) < 25; }), JSON.stringify(hs));
    await page.keyboard.press('Escape');
    await undo(); await undo();
  } else ok('the process found', false, pr);
  await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.waitForTimeout(300); var B6 = await boxAt(A); await page.mouse.click(B6[0], B6[1]); await page.waitForTimeout(400);
  await page.keyboard.press('Delete'); await page.waitForTimeout(1200);
  var t6 = await now();
  ok('Delete: the cardinality out, its line kept', bbox(t6, A) === null && new RegExp('\\bid="' + A + '"').test(t6));
  for (var v = 0; v < 6; v++) await undo();
  ok('undone to the start', (await now()) === t0);

  await open('glycolysis-celldesigner', 'cd:PROTEIN');
  var c0 = await now(), all = await page.$$eval('#m2-img [data-e]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-e'); }))); }), link = all.filter(function (e) { return /\|[rp]\d+$/.test(e); })[0];
  await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.mouse.click.apply(page.mouse, await lineAt(link)); await page.waitForTimeout(600);
  await type('card', '2');
  var c1 = await now(), C = await boxAt(link);
  await page.mouse.click(10, 880); await page.waitForTimeout(300);
  await page.mouse.click(C[0], C[1]); await page.waitForTimeout(600);
  ok('CellDesigner: a click on the box selects its line (Cardinality 2)', (await shown('card')) === '2', await shown('card'));
  await drag(C, [C[0] + 60, C[1] + 40]);
  var st = await page.evaluate(function () { var s = document.querySelector('.m2-ed-warn'); return s ? s.textContent : ''; });
  ok('CellDesigner: a drag says it stays in the middle', /keeps no place for a cardinality/.test(st), st);
  ok('CellDesigner: nothing changed by the drag', (await now()) === c1);
  await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.waitForTimeout(300);
  await page.mouse.click(C[0], C[1]); await page.waitForTimeout(500);
  await page.keyboard.press('Delete'); await page.waitForTimeout(1200);
  var c2 = await now(), stc = await page.evaluate(function (id) { return window.cd_make.stoichiometry(window.m2EditNow().text, id); }, link);
  ok('CellDesigner: Delete after a click on the box takes out the number, the line kept', stc !== '2' && (await boxAt(link)) === null && all.every(function (id) { return id !== link; }) === false && (await page.$('#m2-img [data-e="' + link + '"]')) !== null, String(stc));
  ok('no script error', !errs.length, errs.join(' | '));
  console.log(bad ? bad + ' WRONG' : 'all ok');
  await b.close();
  process.exit(bad ? 1 : 0);
})();
