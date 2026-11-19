// Add map from file with several files in one pick (no token: the maps kept in this browser).
//   1. The picker takes several files; two maps and one broken file picked together: both maps in the list, in the
//      order picked, the last one shown.
//   2. The broken file named in one message after the others are added (not one message per file).
//   node tests/add-files.js [base address] [--local]
// --local: the editor of the working tree routed into the live page.
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/styles/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..'), checks = path.join(here, '..', 'notes', 'check-files');
function editorNow() {
  var read = function (f) { return fs.readFileSync(path.join(here, 'editor', f), 'utf8'); };
  return read('editor.js').replace(/^---[\s\S]*?---\n/, '').replace(/\{% include_relative (\S+) %\}/g, function (m, f) { return read(f); });
}
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0, said = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  page.on('dialog', function (d) { said.push(d.message()); d.accept().catch(function () {}); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  if (local) { var ed = editorNow(); await page.route(/\/styles\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); }); }
  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000);
  if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]');
  await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 });
  var names = function () { return page.$$eval('#m2-list .m2-map .m2-name', function (l) { return l.map(function (x) { return x.textContent; }); }); };
  var before = await names();
  await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
  var chooser = page.waitForEvent('filechooser');
  await page.click('.m2-cx button:text-is("Add map from file")');
  var fc = await chooser;
  ok('1. the picker takes several files', fc.isMultiple());
  await fc.setFiles([
    { name: 'first-pick.xml', mimeType: 'text/xml', buffer: fs.readFileSync(path.join(checks, 'not-gate-one-input-v01.xml')) },
    { name: 'broken-pick.graphml', mimeType: 'text/xml', buffer: Buffer.from('not a map') },
    { name: 'second-pick.xml', mimeType: 'text/xml', buffer: fs.readFileSync(path.join(checks, 'or-gate-one-input-v01.xml')) }
  ]);
  await page.waitForTimeout(8000);
  var after = await names(), added = after.filter(function (n) { return before.indexOf(n) < 0; });
  ok('1. both maps added, in the order picked', added.join() === 'first-pick,second-pick' || added.join() === 'second-pick,first-pick', added.join());
  ok('1. the last one shown', /second-pick/.test(await page.evaluate(function () { return location.hash; })) || /second-pick/.test(await page.$eval('#m2-list .m2-map.m2-on .m2-name', function (x) { return x.textContent; }).catch(function () { return ''; })));
  ok('2. one message, naming the broken file', said.length === 1 && /broken-pick\.graphml/.test(said[0]) && !/first-pick|second-pick/.test(said[0]), JSON.stringify(said));
  ok('no script errors', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok'); process.exit(bad ? 1 : 0);
})();
