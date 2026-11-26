// Sizes and antennas of processes and logic gates in Properties (create.js hubGroup, hubFit, Standard size, sbgn_edit
// antenna, antennas, resize), on Testing Glycolysis (SBGN-ML): a process selected shows Width, Height and Antenna with
// Set as default, Apply to all of this kind and Standard size; Antenna typed sets that process's ports only and Undo
// takes it back; Width typed keeps its antenna; Apply to all gives every process its size and antenna; Standard size
// gives the standard size and antenna (a process 20, a gate 24 with letters 10, antennas 10), one glyph or every one
// selected by Select all of this kind. Read from the SBGN-ML text the editor would save (bboxes, ports, render font
// sizes). Nothing is saved (no token). No script error.
//   node tests/antenna.js --data=<clone of the data repository> [address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright');
var OM = require('./lib/open-map.js'), argv = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });   // --data=... is no address or folder
var url = argv[0] || 'https://viewer-source.github.io/styles/#testing-glycolysis-sbgn', local = argv[1], base = url.split('#')[0], ref = url.split('#')[1] || '', fs = require('fs'), path = require('path');
var X = require('@xmldom/xmldom');
function hubs(s) {   // { id: { cls, w, h, ant, font } } of the processes and gates of SBGN-ML text s
  var d = new X.DOMParser().parseFromString(s, 'application/xml'), out = {}, font = {};
  var att = function (el, k) { var a = Array.prototype.filter.call(el.attributes, function (q) { return q.localName === k; })[0]; return a ? a.value : null; };   // a render attribute, prefixed or not
  Array.prototype.forEach.call(d.getElementsByTagNameNS('*', 'style'), function (st) {
    var g = st.getElementsByTagNameNS('*', 'g')[0], f = g && att(g, 'font-size');
    if (f) (att(st, 'idList') || '').split(/\s+/).forEach(function (i) { font[i] = +f; });
  });
  Array.prototype.forEach.call(d.getElementsByTagNameNS('*', 'glyph'), function (g) {
    var c = g.getAttribute('class') || '';
    if (!/^(process|omitted process|uncertain process|and|or|not)$/.test(c)) return;
    var b = Array.prototype.filter.call(g.childNodes, function (k) { return k.localName === 'bbox'; })[0], x = +b.getAttribute('x'), y = +b.getAttribute('y'), w = +b.getAttribute('w'), h = +b.getAttribute('h');
    var ant = null;
    Array.prototype.filter.call(g.childNodes, function (k) { return k.localName === 'port'; }).forEach(function (p) {
      var dx = Math.abs(+p.getAttribute('x') - x - w / 2), dy = Math.abs(+p.getAttribute('y') - y - h / 2), L = dx >= dy ? dx - w / 2 : dy - h / 2;
      if (ant == null || L > ant) ant = Math.round(L * 100) / 100;
    });
    out[g.getAttribute('id')] = { cls: c, w: w, h: h, ant: ant, font: font[g.getAttribute('id')] };
  });
  return out;
}
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
    await page.route('**/renderers/yrender/yrender.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/yrender/yrender.js'), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var now = async function () { return hubs(await page.evaluate(function () { return window.m2EditNow().text; })); };
  await OM.open(page, base, ref);
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
  if (!(await page.$('#m2-editwin:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForFunction(function () { return !!window.m2EditNow(); }, null, { timeout: 30000 }); await page.waitForTimeout(3000);
  var spot = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
  var pick = async function (id) { await page.keyboard.press('Escape'); await page.mouse.click(10, 880); var P = await spot(id); await page.mouse.click(P[0], P[1]); await page.waitForTimeout(500); };
  var shown = function (sel) { return page.$eval(sel, function (x) { return !x.hidden && !x.closest('[hidden]'); }); };
  var rows = function () { return page.$$eval('.m2-ed-pnode tr[data-k]', function (l) { return l.filter(function (r) { return !r.hidden && !r.closest('[hidden]'); }).map(function (r) { return r.dataset.k; }); }); };
  var type = async function (k, v) { await page.fill('#m2-ed-' + k, v); await page.press('#m2-ed-' + k, 'Enter'); await page.waitForTimeout(1500); };
  var undo = async function () { await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.keyboard.press('Control+z'); await page.waitForTimeout(1500); };
  var H0 = await now(), procs = Object.keys(H0).filter(function (i) { return /process/.test(H0[i].cls) && H0[i].ant != null; }), gates = Object.keys(H0).filter(function (i) { return /^(and|or|not)$/.test(H0[i].cls); });
  ok('the map has processes with ports and gates', procs.length > 2 && gates.length > 0, JSON.stringify(H0));
  var p = procs[0];
  // 1. one process: its rows and buttons
  await pick(p);
  var r = await rows();
  ok('a process shows Width, Height and Antenna', ['w', 'h', 'ant'].every(function (k) { return r.indexOf(k) >= 0; }), r.join(','));
  ok('Antenna shows its length', (await page.inputValue('#m2-ed-ant')) === String(H0[p].ant), await page.inputValue('#m2-ed-ant'));
  ok('Set as default, Apply to all of this kind and Standard size shown', (await shown('.m2-ed-pdef')) && (await shown('.m2-ed-pall')) && (await shown('.m2-ed-pstd')));
  // 2. Antenna typed: that process only, undone in one step
  await type('ant', '14');
  var H = await now();
  ok('Antenna 14 set on that process', H[p].ant === 14, JSON.stringify(H[p]));
  ok('the other processes keep theirs', procs.slice(1).every(function (i) { return H[i].ant === H0[i].ant; }));
  await undo(); H = await now();
  ok('Undo takes the antenna back', H[p].ant === H0[p].ant, JSON.stringify(H[p]));
  // 3. Width typed: the antenna kept
  await pick(p); await type('w', '30'); H = await now();
  ok('Width 30 set', H[p].w === 30, JSON.stringify(H[p]));
  ok('its antenna as long as before', H[p].ant === H0[p].ant, JSON.stringify(H[p]));
  // 4. Apply to all of this kind
  await pick(p); await type('ant', '12'); await pick(p); await page.click('.m2-ed-pall'); await page.waitForTimeout(1500); H = await now();
  ok('Apply to all: every process 30 wide with antenna 12', procs.every(function (i) { return H[i].w === 30 && H[i].ant === 12; }), JSON.stringify(procs.map(function (i) { return H[i]; })));
  ok('Apply to all: the gates unchanged', gates.every(function (i) { return H[i].w === H0[i].w; }));
  await undo(); H = await now();
  ok('Undo takes Apply to all back in one step', procs.slice(1).every(function (i) { return H[i].w === H0[i].w && H[i].ant === H0[i].ant; }) && H[p].ant === 12, JSON.stringify(procs.map(function (i) { return H[i]; })));
  // 5. Standard size, one process
  await pick(p); await page.click('.m2-ed-pstd'); await page.waitForTimeout(1500); H = await now();
  ok('Standard size: the process 20 by 20 with antenna 10', H[p].w === 20 && H[p].h === 20 && H[p].ant === 10, JSON.stringify(H[p]));
  // 6. Standard size, a gate: 24, antenna 10, letters 10
  var g = gates.filter(function (i) { return H0[i].ant != null; })[0] || gates[0];
  await pick(g); r = await rows();
  ok('a gate shows Width and Height', ['w', 'h'].every(function (k) { return r.indexOf(k) >= 0; }), r.join(','));
  await page.click('.m2-ed-pstd'); await page.waitForTimeout(1500); H = await now();
  ok('Standard size: the gate 24 by 24, letters 10', H[g].w === 24 && H[g].h === 24 && H[g].font === 10, JSON.stringify(H[g]));
  ok('Standard size: the gate’s antenna 10 (where it has ports)', H0[g].ant == null || H[g].ant === 10, JSON.stringify(H[g]));
  // 7. every process by Select all of this kind, then Standard size
  await page.keyboard.press('Escape'); await page.mouse.click(10, 880);
  var P = await spot(procs[1]); await page.mouse.click(P[0], P[1], { button: 'right' }); await page.waitForTimeout(300);
  await page.click('.m2-cx button:text-is("Select all of this kind")'); await page.waitForTimeout(500);
  ok('several processes: Standard size shown, Apply to all not', (await shown('.m2-ed-pstd')) && !(await shown('.m2-ed-pall')));
  await page.click('.m2-ed-pstd'); await page.waitForTimeout(1500); H = await now();
  ok('every process 20 by 20 with antenna 10', procs.every(function (i) { return H[i].w === 20 && H[i].h === 20 && H[i].ant === 10; }), JSON.stringify(procs.map(function (i) { return H[i]; })));
  // 8. a line selected: none of the three buttons
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
