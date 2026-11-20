// Line width in a line's Properties (create.js edgeSet; sbgn_edit rewidth, cd_make rewidthLine): on the styles page, an
// SBGN-ML arc on Testing Glycolysis and a CellDesigner modifier and main line on Glycolysis each typed 3: written into
// the file (SBGN-ML: the stroke-width of a style naming the arc; CellDesigner: its celldesigner:line width), drawn 3
// wide, shown in the field; 50 typed sets 20 (the limit, silently); undo puts the file back as it was. Nothing is saved
// (no token). No script error.
//   node tests/line-width.js [base address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  if (local) {
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/layout/layout.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/layout/layout.js'), 'utf8') }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var erows = function () { return page.$$eval('.m2-ed-pedge tr[data-k]', function (l) { return l.filter(function (r) { return !r.hidden && !r.closest('[hidden]'); }).map(function (r) { return r.dataset.k; }); }); };
  var type = async function (k, v) { await page.fill('#m2-ed-' + k, v); await page.press('#m2-ed-' + k, 'Enter'); await page.waitForTimeout(1200); };
  var widths = function (id) { return page.$$eval('#m2-img [data-e="' + id + '"] polyline, #m2-img [data-e="' + id + '"] path', function (l) { return l.map(function (x) { return x.getAttribute('stroke-width'); }).filter(Boolean); }); };
  var lineAt = function (id) { return page.evaluate(function (id) {   // the middle of the line's longest drawn part, on screen
    var all = []; document.querySelectorAll('#m2-img [data-e="' + id + '"]').forEach(function (g) { all.push(g); g.querySelectorAll('*').forEach(function (c) { all.push(c); }); });
    var q = all.filter(function (x) { return x.getTotalLength; }).sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0], pt = q.getPointAtLength(q.getTotalLength() / 2), m = q.getScreenCTM();
    return [m.a * pt.x + m.c * pt.y + m.e, m.b * pt.x + m.d * pt.y + m.f]; }, id); };
  var open = async function (hash, mark) {
    await page.goto('about:blank'); await page.goto(base + '#' + hash, { waitUntil: 'load' });   // a page of its own, not a hash change await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    if (!(await page.$('#m2-editwin button[data-make="' + mark + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + mark + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var pick = async function (id) { await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.mouse.click.apply(page.mouse, await lineAt(id)); await page.waitForTimeout(600); };
  var undo = async function () { await page.mouse.click(10, 880); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200); };
  var es = function () { return page.$$eval('#m2-img [data-e]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-e'); }))); }); };

  // SBGN-ML: an arc between two entities (no process at either end)
  await open('glycolysis-sbgn', 'compartment');
  var t0 = await now(), arcs = (t0.match(/<(?:\w+:)?arc\b[^>]*>/g) || []).map(function (a) { return /\bid="([^"]+)"/.exec(a)[1]; }), ids = await es();
  var arc = await page.evaluate(function (as) {   // the longest drawn arc, so a click at its middle finds it alone
    var len = function (a) { var g = document.querySelector('#m2-img [data-e="' + a + '"] path'); return g && g.getTotalLength ? g.getTotalLength() : 0; };
    return as.sort(function (u, v) { return len(v) - len(u); })[0]; }, arcs.filter(function (a) { return ids.indexOf(a) >= 0; }));
  await pick(arc);
  var er = await erows();
  ok('SBGN-ML: Line colour, Line width and the ports', er[0] === 'ecol' && er[1] === 'ewid' && er.indexOf('sx') >= 0, JSON.stringify(er));
  ok('SBGN-ML: width 1 shown', (await page.inputValue('#m2-ed-ewid')) === '1', await page.inputValue('#m2-ed-ewid'));
  await type('ewid', '3');
  var st = function (t) { return (t.match(/<(?:\w+:)?style\b[\s\S]*?<\/(?:\w+:)?style>/g) || []).filter(function (s) { return new RegExp('idList="[^"]*\\b' + arc + '\\b').test(s); }).join(' '); };
  var t1 = await now();
  ok('SBGN-ML: written as the stroke-width of a style naming the arc', /stroke-width="3"/.test(st(t1)), st(t1));
  ok('SBGN-ML: drawn 3 wide', (await widths(arc)).indexOf('3') >= 0, JSON.stringify(await widths(arc)));
  ok('SBGN-ML: shown 3', (await page.inputValue('#m2-ed-ewid')) === '3');
  await type('ewid', '50');
  ok('SBGN-ML: 50 typed sets 20', /stroke-width="20"/.test(st(await now())), st(await now()));
  await undo(); await undo();
  ok('SBGN-ML: undone twice, the file as it was', (await now()) === t0);

  // CellDesigner: a modifier's line and a reaction's main line
  await open('glycolysis-celldesigner', 'cd:PROTEIN');
  var c0 = await now(), all = await es(), mod = all.filter(function (e) { return /\|m\d+$/.test(e); })[0], main = all.filter(function (e) { return /\|a$/.test(e); })[0];
  for (var L of [mod, main]) {
    await pick(L);
    er = await erows();
    ok(L + ': Line colour and Line width', JSON.stringify(er) === JSON.stringify(['ecol', 'ewid']), JSON.stringify(er));
    var w0 = await page.evaluate(function (L) { return window.cd_make.lineWidth(window.m2EditNow().text, L); }, L);
    ok(L + ': its width shown', +(await page.inputValue('#m2-ed-ewid')) === w0, (await page.inputValue('#m2-ed-ewid')) + ' ' + w0);
    await type('ewid', '3');
    var w1 = await page.evaluate(function (L) { return window.cd_make.lineWidth(window.m2EditNow().text, L); }, L);
    ok(L + ': written 3', w1 === 3, w1);
    ok(L + ': drawn 3 wide', (await widths(L)).indexOf('3') >= 0, JSON.stringify(await widths(L)));
    if (L === main) ok(L + ': the whole reaction, its other half too', (await widths(L.replace(/\|a$/, '|b'))).indexOf('3') >= 0);
  }
  await undo(); await undo();
  ok('CellDesigner: undone twice, the file as it was', (await now()) === c0);
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
