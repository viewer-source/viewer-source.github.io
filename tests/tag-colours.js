// Tags and terminals coloured as other glyphs: on the SBGN website's insulin-like growth factor map with its MAPK
// cascade submap, from the test set (MAP=<id> ID=<glyph> for another; a demo map edited by hand may lose its terminal), its terminal glyph41, the
// terminal selected shows Fill colour, Border colour and Border width in Properties; a fill and a border typed there are
// written into the file's render extension; Colours Mist and sage (the Default colours) then gives it a tag's white, Confetti a pastel of its own,
// and one undo takes the recolouring back. Nothing is saved (no token). No script error.
//   node tests/tag-colours.js [base address] [viewer folder: its editor served in place of the page's]
var engine = require('playwright')[process.env.BROWSER || 'chromium'], fs = require('fs'), path = require('path');   // BROWSER=webkit or firefox: the same test in another engine
var NOISE = require('./lib/noise.js');   // what a browser reports that is no fault of the page
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3], bad = 0, ID = process.env.ID || 'glyph41';
var MAP = process.env.MAP || 'external-sbgn-website-downloads-examples-insulin-like-growth-factor-signaling-withsubmap-mapk-cascade-sbgn';
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
(async function () {
  var b = await engine.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [];
  page.on('pageerror', function (e) { if (!NOISE.test(e.message)) errs.push(e.message); });
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  var look = function () {   // the terminal's fill and border colour as the file's styles give them (the last style naming it that gives each)
    return page.evaluate(function (id) {
      var d = new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml'), o = { fill: null, stroke: null }, cols = {};
      var at = function (e, n) { var a = Array.from(e.attributes).filter(function (x) { return x.localName === n; })[0]; return a ? a.value : null; };   // the file's prefixed attributes too (ns2:idList)
      var all = Array.from(d.getElementsByTagName('*'));
      all.filter(function (e) { return e.localName === 'colorDefinition'; }).forEach(function (c) { cols[at(c, 'id')] = at(c, 'value'); });
      all.filter(function (e) { return e.localName === 'style' && (' ' + (at(e, 'idList') || '') + ' ').indexOf(' ' + id + ' ') >= 0; }).forEach(function (st) {
        var g = st.firstElementChild;
        ['fill', 'stroke'].forEach(function (k) { var v = g && at(g, k); if (v) o[k] = (cols[v] || v).slice(0, 7).toUpperCase(); });
      });
      return o;
    }, ID);
  };
  var pick = async function (name) {
    var F = '#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd';
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.click(F); await page.waitForTimeout(200);
    await page.click('body > .m2-ed-pdl button:has-text("' + name + '")'); await page.waitForTimeout(2500);
  };
  var select = async function () {
    var c = await page.$eval('[data-n="' + ID + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.click(c[0], c[1]); await page.waitForTimeout(600);
  };
  var shown = function (k) { return page.$eval('#m2-editwin .m2-ed-pnode tr[data-k="' + k + '"]', function (r) { return !r.hidden && r.offsetParent !== null; }).catch(function () { return false; }); };
  await page.goto(base, { waitUntil: 'load' }); await page.evaluate(function () { localStorage.clear(); });
  await page.goto(base + '#' + MAP, { waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(1500);
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()) && !!document.querySelector('[data-n]'); }, null, { timeout: 30000 }); await page.waitForTimeout(1500);
  await select();
  var rows = [await shown('fill'), await shown('line'), await shown('width')];
  ok('the terminal selected: Fill colour, Border colour, Border width in Properties', rows.every(Boolean), JSON.stringify(rows));
  var set = async function (k, v) { var f = '#m2-ed-' + k; await page.fill(f, v); await page.press(f, 'Enter'); await page.waitForTimeout(1500); };
  await set('fill', '#123456'); await set('line', '#654321');
  var l1 = await look();
  ok('a fill and a border typed are written into the file', l1.fill === '#123456' && l1.stroke === '#654321', JSON.stringify(l1));
  await pick('Mist and sage');   // the Default colours
  var l2 = await look();
  ok('Colours Mist and sage (the Default colours): a tag’s white, border black', l2.fill === '#FFFFFF' && (l2.stroke === null || l2.stroke === '#000000'), JSON.stringify(l2));
  await pick('Confetti');
  var l3 = await look(), pastel = l3.fill && (function (h) { var r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return Math.min(r, g, b) > 150 && Math.max(r, g, b) - Math.min(r, g, b) > 15; })(l3.fill);
  ok('Colours Confetti: a pastel of its own', pastel, JSON.stringify(l3));
  await page.keyboard.press('Escape'); await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await page.waitForTimeout(2000);
  var l4 = await look();
  ok('one undo: Default’s white back', l4.fill === '#FFFFFF', JSON.stringify(l4));
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
