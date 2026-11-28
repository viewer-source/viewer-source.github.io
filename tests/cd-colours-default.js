// Colours under the CellDesigner palette (editor/src/cdcreate.js cdColourIn) on the Glycogen liver CellDesigner map, which
// has proteins, simple molecules, complexes and compartments but no phenotype, gene or RNA: From map gives the map's
// colour for a class it has and the Default colour for one it has none of (never CellDesigner's own); a new compartment
// takes the map's compartment colour under From map, the Default one (#DFDBCE, drawn at a quarter as #F7F6F3) under
// Default, CellDesigner's yellow under CellDesigner, white under No colours; an Unknown species, drawn with no outline,
// light grey (#DDDDDD) under From map with none on the map, Default and No colours; the squares of Default and Custom show no
// CellDesigner colour. Nothing is saved (no token). No script error.
//   node tests/cd-colours-default.js [base address] [viewer folder: its editor and converter scripts served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {   // the editor as Jekyll builds it, and the converter's scripts, from a working tree
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    ['cd_make', 'sbgn_edit'].forEach(function (f) {
      page.route('**/renderers/converter/' + f + '.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', f + '.js'), 'utf8') }); });
    });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var made = async function (k, x, y) { var a = await ids(); await page.click('#m2-editwin button[data-make="' + k + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(900); await page.keyboard.press('Escape'); return (await ids()).filter(function (i) { return a.indexOf(i) < 0; })[0]; };
  var pick = async function (name) { await page.keyboard.press('Escape'); await page.mouse.click(1350, 880); await page.waitForTimeout(300); await page.click('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd'); await page.waitForTimeout(200); await page.click('body > .m2-ed-pdl button:has-text("' + name + '")'); await page.waitForTimeout(200); };
  var paint = function (id) { return page.evaluate(function (id) { var t = window.m2EditNow().text, i = t.indexOf(' id="' + id + '"'), e = t.indexOf('</celldesigner:', i), m = /<celldesigner:paint color="([0-9a-fA-F]{8})"/.exec(t.slice(i, t.indexOf('Alias>', e) + 6)); return m ? m[1].toLowerCase() : null; }, id); };
  var squares = function () { return page.evaluate(async function () { document.querySelector('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd').click(); await new Promise(function (r) { setTimeout(r, 200); }); var o = {}; document.querySelectorAll('body > .m2-ed-pdl button').forEach(function (x) { o[x.querySelector('span').textContent] = Array.from(x.querySelectorAll('i')).map(function (i) { return i.title; }).join(' | '); }); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return o; }); };
  await page.goto(base, { waitUntil: 'load' }); await page.evaluate(function () { ['atlas-edit-map-choices', 'atlas-edit-cd-defaults'].forEach(function (k) { localStorage.removeItem(k); }); });
  await page.goto(base + '#glycogen-liver-celldesigner', { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  if (!(await page.$('#m2-editwin button[data-make="cd:PROTEIN"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="cd:PROTEIN"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  var S = await squares(); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  var CD = /CCFFCC|CCFF66|CC99FF|FFFF66|66FF66/i;
  ok('Mist and sage squares: no CellDesigner colour', S['Mist and sage'] && !CD.test(S['Mist and sage']), S['Mist and sage']);
  ok('Custom default squares (none kept): no CellDesigner colour', S['Custom default'] && !CD.test(S['Custom default']), S['Custom default']);
  ok('CellDesigner squares: its own', CD.test(S.CellDesigner || ''), S.CellDesigner);
  // From map (the choice when none is kept)
  var pr = await made('cd:PROTEIN', 700, 820), ph = await made('cd:PHENOTYPE', 820, 820), gn = await made('cd:GENE', 940, 820), rn = await made('cd:RNA', 1060, 820), cp = await made('cd:COMPARTMENT', 1180, 760);
  ok('From map: a protein in the map’s blue', await paint(pr) === 'ffc8d8eb', await paint(pr));
  ok('From map, none on the map: a phenotype white (Default)', await paint(ph) === 'ffffffff', await paint(ph));
  ok('a gene white', await paint(gn) === 'ffffffff', await paint(gn));
  ok('an RNA white', await paint(rn) === 'ffffffff', await paint(rn));
  var uk = await made('cd:UNKNOWN', 580, 820);
  ok('From map, none on the map: an Unknown light grey (drawn with no outline, so never white)', await paint(uk) === 'ffdddddd', await paint(uk));
  ok('a compartment in the map’s compartment colour', await paint(cp) === 'ffdfdbce', await paint(cp));
  // the map's compartments are the Default colour here, so From map's own reading is checked on the map's text recoloured
  var own = await page.evaluate(function () { return window.cd_make.compartmentColour(window.m2EditNow().text.replace(/(<celldesigner:compartmentAlias [\s\S]*?<celldesigner:paint color=")[0-9a-fA-F]{8}/g, '$1FF123456')); });
  ok('From map reads the map’s compartment colour (recoloured: ff123456)', own === 'ff123456', own);
  await pick('CellDesigner');
  var ph2 = await made('cd:PHENOTYPE', 820, 700), cp2 = await made('cd:COMPARTMENT', 1180, 560);
  ok('CellDesigner: a phenotype in its own purple', await paint(ph2) === 'ffcc99ff', await paint(ph2));
  ok('a compartment in its own yellow', await paint(cp2) === 'ffcccc00', await paint(cp2));
  await pick('Mist and sage');
  var cp3 = await made('cd:COMPARTMENT', 1180, 360), sm = await made('cd:SIMPLE_MOLECULE', 700, 700);
  ok('Default: a compartment #DFDBCE', await paint(cp3) === 'ffdfdbce', await paint(cp3));
  // the Default compartment drawn at a quarter (cdrender) is the Default scheme's compartment (SCHEMES in the page)
  var drift = await page.evaluate(function (p) { var m = /'default': '([0-9A-F]{6})/.exec(document.documentElement.innerHTML), q = p.slice(2).match(/../g).map(function (h) { return Math.round(255 - (255 - parseInt(h, 16)) * 0.25).toString(16).toUpperCase(); }).join(''); return [m && m[1], q]; }, await paint(cp3));
  ok('drawn at a quarter it is the Default scheme’s compartment', drift[0] && drift[0] === drift[1], JSON.stringify(drift));
  ok('a simple molecule #DBEBDB', await paint(sm) === 'ffdbebdb', await paint(sm));
  var uk2 = await made('cd:UNKNOWN', 580, 700);
  ok('Default: an Unknown light grey #DDDDDD', await paint(uk2) === 'ffdddddd', await paint(uk2));
  await page.mouse.click(580, 700); await page.waitForTimeout(500);
  var ukRows = await page.evaluate(function () { var r = function (k) { var t = document.querySelector('#m2-editwin .m2-ed-pnode tr[data-k="' + k + '"]'); return !!t && !t.hidden && !!t.offsetParent; }; return { fill: r('fill'), width: r('width'), line: r('line') }; });
  ok('an Unknown selected: Fill colour in Properties, no border colour or width (no outline in CellDesigner)', ukRows.fill && !ukRows.width && !ukRows.line, JSON.stringify(ukRows));
  await page.keyboard.press('Escape');
  await pick('No colours');
  var cp4 = await made('cd:COMPARTMENT', 1180, 200);
  ok('No colours: a compartment white', await paint(cp4) === 'ffffffff', await paint(cp4));
  var uk3 = await made('cd:UNKNOWN', 580, 580);
  ok('No colours: an Unknown light grey, not white', await paint(uk3) === 'ffdddddd', await paint(uk3));
  ok('no script error', !errs.length, errs.join(' / '));
  await page.evaluate(function () { localStorage.removeItem('atlas-edit-map-choices'); });
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
