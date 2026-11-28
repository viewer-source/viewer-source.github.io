// Properties for every SBGN-ML glyph (create.js sbNode, sbOff; sbgn_edit LOOKS) on Testing Glycolysis SBGN-ML: a complex
// with members (Label, Width, Height, Fill colour, Border colour, Border width; no Multimer), its fill and border colour
// written into the file's styles, its width typed narrower than its members stopping round them; a process (Fill
// colour, Border colour, Border width, with its Width, Height and Antenna; no Label), its border colour written; a compartment made from the palette
// (Label, Width, Height and the colours), its fill written. Each read back from the SBGN-ML text the editor would save.
// Nothing is saved (no token). No script error.
//   node tests/sbgn-props.js [address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var url = process.argv[2] || 'https://viewer-source.github.io/#glycolysis-sbgn', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/layout/layout.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/layout/layout.js'), 'utf8') }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var rows = function () { return page.$$eval('.m2-ed-pnode tr[data-k]', function (l) { return l.filter(function (r) { return !r.hidden && !r.closest('[hidden]'); }).map(function (r) { return r.dataset.k; }); }); };
  var type = async function (k, v) { await page.fill('#m2-ed-' + k, v); await page.press('#m2-ed-' + k, 'Enter'); await page.waitForTimeout(1200); };
  var styled = function (t, id) {   // the render styles naming the glyph, as one string of their attributes
    return (t.match(/<(?:\w+:)?style\b[\s\S]*?<\/(?:\w+:)?style>/g) || []).filter(function (s) { return new RegExp('idList="[^"]*\\b' + id + '\\b').test(s); }).join(' ');
  };
  var colourOf = function (t, v) { var m = new RegExp('<(?:\\w+:)?colorDefinition id="([^"]+)" value="' + v + '(?:FF)?"', 'i').exec(t); return m ? m[1] : null; };
  var has = function (t, id, attr, v) { var s = styled(t, id), c = colourOf(t, v); return new RegExp(attr + '="(' + v + '(FF)?' + (c ? '|' + c : '') + ')"', 'i').test(s); };
  var select = async function (id, at) {   // a click at the node's box: at [fx, fy] its share across
    await page.keyboard.press('Escape');
    var P = await page.$eval('#m2-img [data-n="' + id + '"]', function (g, a) { var r = g.getBoundingClientRect(); return [r.left + r.width * a[0], r.top + r.height * a[1]]; }, at || [0.5, 0.5]);
    await page.mouse.click(P[0], P[1]); await page.waitForTimeout(500);
  };
  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  if (!(await page.$('#m2-editwin button[data-make="compartment"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="compartment"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);

  // a complex with members (one with a glyph inside it), clicked on its own space (its bottom band); a process
  var t0 = await now(), cxs = [], re = /<(?:\w+:)?glyph class="complex" id="([^"]+)"/g, m;
  while ((m = re.exec(t0))) cxs.push(m[1]);
  var CX = cxs.filter(function (c) { return new RegExp('<(?:\\w+:)?glyph class="complex" id="' + c + '"[^>]*>(?:(?!</(?:\\w+:)?glyph>)[\\s\\S])*?<(?:\\w+:)?glyph class="(macromolecule|simple chemical)').test(t0); })[0];
  var PR = (/<(?:\w+:)?glyph class="process" id="([^"]+)"/.exec(t0) || [])[1];
  ok('a complex with members and a process found', !!CX && !!PR, CX + ' ' + PR);
  await select(CX, [0.5, 0.97]);
  var rc = await rows();
  ok('a complex: Label, Font size, Width, Height, Fill colour, Border colour, Border width', JSON.stringify(rc) === JSON.stringify(['label', 'font', 'w', 'h', 'fill', 'line', 'width']), JSON.stringify(rc));
  await type('font', '20');
  ok('its font size written into its style', has(await now(), CX, 'font-size', '20'), styled(await now(), CX));
  await type('fill', '#ffeedd');
  ok('its fill written into its style', has(await now(), CX, 'fill', '#FFEEDD'), styled(await now(), CX));
  await select(CX, [0.5, 0.97]); await type('line', '#cc0000');
  ok('its border colour written', has(await now(), CX, 'stroke', '#CC0000'), styled(await now(), CX));
  var w0 = await page.$eval('#m2-img [data-n="' + CX + '"]', function (g) { return g.getBoundingClientRect().width; });
  await select(CX, [0.5, 0.97]); await type('w', '10');
  var w1 = await page.$eval('#m2-img [data-n="' + CX + '"]', function (g) { return g.getBoundingClientRect().width; });
  ok('typed narrower than its members, it stops round them', w1 > w0 * 0.5, w0 + ' ' + w1);

  // a process
  await select(PR);
  var rp = await rows();
  ok('a process: Width, Height, Fill colour, Border colour, Border width, Antenna', JSON.stringify(rp) === JSON.stringify(['w', 'h', 'fill', 'line', 'width', 'ant']), JSON.stringify(rp));   // its size and antenna: tests/antenna.js
  await type('line', '#0066cc');
  ok('its border colour written', has(await now(), PR, 'stroke', '#0066CC'), styled(await now(), PR));

  // a compartment from the palette
  var before = await ids();
  await page.click('#m2-editwin button[data-make="compartment"]'); await page.mouse.click(1150, 700); await page.waitForTimeout(1500);
  var comp = (await ids()).filter(function (i) { return before.indexOf(i) < 0; })[0];
  ok('a compartment made', !!comp, comp);
  if (comp) {
    await select(comp, [0.02, 0.5]);
    var rr = await rows();
    ok('a compartment: Label, Font size, Width, Height, Fill colour, Border colour, Border width', JSON.stringify(rr) === JSON.stringify(['label', 'font', 'w', 'h', 'fill', 'line', 'width']), JSON.stringify(rr));
    await type('fill', '#eef4ff');
    ok('its fill written', has(await now(), comp, 'fill', '#EEF4FF'), styled(await now(), comp));
  }

  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
